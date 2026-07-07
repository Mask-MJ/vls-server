import {
  Inject,
  Injectable,
  InternalServerErrorException,
  StreamableFile,
  Logger,
} from '@nestjs/common';
import {
  chartDto,
  CreateFactoryDto,
  importDto,
  QueryFactoryDto,
  reportDto,
  UpdateFactoryDto,
} from './factory.dto';
import { CustomPrismaService } from 'nestjs-prisma';
import { ExtendedPrismaClient } from 'src/common/pagination/prisma.extension';
import { ActiveUserData } from 'src/modules/iam/interfaces/active-user-data.interface';
import { read, utils } from 'xlsx';
import dayjs from 'dayjs';
import { parseExcelDate } from 'src/common/utils/parse-excel-date';
import {
  toStr,
  toIntOrNull,
} from 'src/common/utils/normalize-xlsx-value';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { readFileSync } from 'fs';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { patchDocument, PatchType, TextRun } from 'docx';
import { mockReport } from './mock';
import {
  table_alarm,
  chart_valves_health_overview,
  chart_values_alarm_overivew,
  chart_valves_quarter,
  table_valves_health_month,
  detail_valves_alarm,
  // table_dynamic_control_month,
  table_valves_travel_month,
  ValveTravelHistoryRecord,
  table_cyclecount_travelaccumulate,
  ValveDetail,
  ValveDetailItem,
} from './report.helper';
import { MinioService } from 'src/common/minio/minio.service';
import { Valve } from '@prisma/client';
import { getLast12Months } from 'src/common/utils';
import { hasAllFactoryScope } from 'src/common/utils/user-factory-scope';
import { ValveService } from '../valve/valve.service';
import { transformationTree } from 'src/common/utils/transformationTree';
// import { mockValve } from './mock';

@Injectable()
export class FactoryService {
  constructor(
    @Inject('PrismaService')
    private readonly prismaService: CustomPrismaService<ExtendedPrismaClient>,

    @Inject(EventEmitter2)
    private readonly eventEmitter: EventEmitter2,

    @Inject(HttpService)
    private readonly httpService: HttpService,

    private readonly minioClient: MinioService,
    private readonly logger: Logger,

    private readonly valveService: ValveService,
  ) {}
  create(user: ActiveUserData, createFactoryDto: CreateFactoryDto) {
    return this.prismaService.client.factory.create({
      data: { ...createFactoryDto, createBy: user.account },
    });
  }

  async findAll(user: ActiveUserData, queryFactoryDto: QueryFactoryDto) {
    const {
      name,
      beginTime,
      endTime,
      filterId,
      updatedBeginTime,
      updatedEndTime,
      sortBy,
      sortOrder,
    } = queryFactoryDto;
    const userData = await this.prismaService.client.user.findUnique({
      where: { id: user.sub },
      include: { role: true },
    });
    const baseWhere = {
      name: { contains: name, mode: 'insensitive' as const },
      NOT: { id: filterId, parentId: filterId },
      createdAt: { gte: beginTime, lte: endTime },
      ...(updatedBeginTime || updatedEndTime
        ? { updatedAt: { gte: updatedBeginTime, lte: updatedEndTime } }
        : {}),
    };
    // 默认 updatedAt desc(最近变化在上,客户 #12 加"更新时间"筛选的直觉);
    // createdAt 兜底稳定同刻记录的相对顺序
    const orderBy = sortBy
      ? [{ [sortBy]: sortOrder ?? 'desc' }]
      : [{ updatedAt: 'desc' as const }, { createdAt: 'desc' as const }];
    if (hasAllFactoryScope(userData)) {
      const factories = await this.prismaService.client.factory.findMany({
        where: baseWhere,
        orderBy,
      });
      return {
        totalCount: factories.length,
        rows: transformationTree(factories, null),
      };
    }
    const roleIds = userData.role.map((item) => item.id);
    const factories = await this.prismaService.client.factory.findMany({
      where: {
        ...baseWhere,
        role: { some: { id: { in: roleIds } } },
      },
      include: { role: true },
      orderBy,
    });
    return {
      totalCount: factories.length,
      rows: transformationTree(factories, null),
    };
  }

  async findAllList(user: ActiveUserData) {
    const userData = await this.prismaService.client.user.findUnique({
      where: { id: user.sub },
      include: { role: true },
    });
    const include = { _count: { select: { valve: true } } } as const;
    if (hasAllFactoryScope(userData)) {
      return this.prismaService.client.factory.findMany({
        include,
        orderBy: { createdAt: 'desc' },
      });
    }
    const roleIds = userData.role.map((item) => item.id);
    return this.prismaService.client.factory.findMany({
      where: {
        OR: [
          { createBy: user.account },
          { role: { some: { id: { in: roleIds } } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include,
    });
  }

  async import(
    user: ActiveUserData,
    file: Express.Multer.File,
    body: importDto,
  ) {
    const workbook = read(file.buffer, { type: 'buffer' });
    const xlsx = utils.sheet_to_json<Valve>(
      workbook.Sheets[workbook.SheetNames[0]],
    );
    xlsx.shift();

    const deviceNames = Array.from(
      new Set(
        xlsx
          .map((item) => item.unit)
          .filter((unit): unit is string => Boolean(unit)),
      ),
    );

    // 串行 upsert 装置，建立 unit → deviceId 映射
    const deviceMap = new Map<string, number>();
    for (const deviceName of deviceNames) {
      let device = await this.prismaService.client.device.findFirst({
        where: { name: deviceName, factoryId: body.factoryId },
      });
      if (!device) {
        device = await this.prismaService.client.device.create({
          data: {
            name: deviceName,
            factoryId: body.factoryId,
            createBy: user.account,
          },
        });
      }
      deviceMap.set(deviceName, device.id);
    }

    // 阀门按 (factoryId, serialNumber) 串行 upsert
    // Why: 一个 tag/位号可能对应多台阀（如主+冗余），唯一身份是 serialNumber；
    //      forEach(async) 并行写库会与 findFirst 形成竞态，导致部分行被覆盖
    let created = 0;
    let updated = 0;
    const skipped: Array<{ row: number; reason: string }> = [];

    for (let idx = 0; idx < xlsx.length; idx += 1) {
      const item = xlsx[idx];
      const rowNumber = idx + 3; // 表头2行 + 1-based

      const deviceId = item.unit ? deviceMap.get(item.unit) : undefined;
      if (!deviceId) {
        skipped.push({ row: rowNumber, reason: 'missing-unit' });
        continue;
      }
      const serial = item.serialNumber ? String(item.serialNumber).trim() : '';
      if (!serial) {
        skipped.push({ row: rowNumber, reason: 'missing-serialNumber' });
        continue;
      }

      try {
        const existing = await this.prismaService.client.valve.findFirst({
          where: { serialNumber: serial, factoryId: body.factoryId },
        });

        // Why: xlsx 单元格若被填表人设成"数字"格式(如 actuatorSize=30、valveSize=4),
        // SheetJS 解析为 number 而非 string。Prisma schema 里这批列都是 String?,
        // 直接喂 number → PrismaClientValidationError → 整行 skip。卡博特蓝星化工 xlsx
        // 接口实测复现(62/62 全部 skipped)。此处统一在边界归一化,不再信任 xlsx 类型。
        //
        // 归一化策略:
        //   - 所有 Prisma String? 列 → toStr(): null/undef → '',其它 → String(v)
        //   - 5 个 Prisma Int? qty 列 → toIntOrNull(): 空串/'-'/'/'/'无'/NaN → null,
        //     '10'/10/10.7 → 10。同时修复旧代码 `qty ? Number(qty) : null` 把 0 错当 null 的 bug。
        const n = {
          no: toStr(item.no),
          tag: toStr(item.tag),
          unit: toStr(item.unit),
          fluidName: toStr(item.fluidName),
          criticalApplication: toStr(item.criticalApplication),
          valveBrand: toStr(item.valveBrand),
          valveSize: toStr(item.valveSize),
          valveEndConnection: toStr(item.valveEndConnection),
          valveBodyMaterial: toStr(item.valveBodyMaterial),
          valveBonnet: toStr(item.valveBonnet),
          valveTrim: toStr(item.valveTrim),
          valveSeatLeakage: toStr(item.valveSeatLeakage),
          valveSeries: toStr(item.valveSeries),
          valveRating: toStr(item.valveRating),
          valveStemSize: toStr(item.valveStemSize),
          valveCv: toStr(item.valveCv),
          valveDescription: toStr(item.valveDescription),
          actuatorBrand: toStr(item.actuatorBrand),
          actuatorSize: toStr(item.actuatorSize),
          actuatorSeries: toStr(item.actuatorSeries),
          handwheel: toStr(item.handwheel),
          actuatorDescription: toStr(item.actuatorDescription),
          actuatorFailurePosition: toStr(item.actuatorFailurePosition),
          positionerBrand: toStr(item.positionerBrand),
          positionerModel: toStr(item.positionerModel),
          positionerDescription: toStr(item.positionerDescription),
          sovBrand: toStr(item.sovBrand),
          sovModel: toStr(item.sovModel),
          sovQty: toIntOrNull(item.sovQty),
          sovDescription: toStr(item.sovDescription),
          lsBrand: toStr(item.lsBrand),
          lsModel: toStr(item.lsModel),
          lsQty: toIntOrNull(item.lsQty),
          lsDescription: toStr(item.lsDescription),
          tripValveBrand: toStr(item.tripValveBrand),
          tripValveModel: toStr(item.tripValveModel),
          tripValveDescription: toStr(item.tripValveDescription),
          vbBrand: toStr(item.vbBrand),
          vbModel: toStr(item.vbModel),
          vbQty: toIntOrNull(item.vbQty),
          vbDescription: toStr(item.vbDescription),
          qeBrand: toStr(item.qeBrand),
          qeModel: toStr(item.qeModel),
          qeQty: toIntOrNull(item.qeQty),
          qeDescription: toStr(item.qeDescription),
          regulatorBrand: toStr(item.regulatorBrand),
          regulatorModel: toStr(item.regulatorModel),
          regulatorDescription: toStr(item.regulatorDescription),
          pilotBrand: toStr(item.pilotBrand),
          pilotModel: toStr(item.pilotModel),
          pilotQty: toIntOrNull(item.pilotQty),
          pilotDescription: toStr(item.pilotDescription),
          stroke: toStr(item.stroke),
          signalComparatorBrand: toStr(item.signalComparatorBrand),
          signalComparatorModel: toStr(item.signalComparatorModel),
          signalComparatorDescription: toStr(item.signalComparatorDescription),
          parts: toStr(item.parts),
        };

        // description 列空缺时,从已归一化的字段拼成 "-" 分隔串。
        // qty 用 toStr 再过滤,避免 null 进 join。
        const joinNonEmpty = (parts: Array<string | null>) =>
          parts.filter((p) => p !== null && p !== '').join('-');

        const data = {
          no: n.no,
          tag: n.tag,
          unit: n.unit,
          fluidName: n.fluidName,
          criticalApplication: n.criticalApplication,
          serialNumber: serial,
          since: parseExcelDate(item.since),
          valveBrand: n.valveBrand,
          valveSize: n.valveSize,
          valveEndConnection: n.valveEndConnection,
          valveBodyMaterial: n.valveBodyMaterial,
          valveBonnet: n.valveBonnet,
          valveTrim: n.valveTrim,
          valveSeries: n.valveSeries,
          valveSeatLeakage: n.valveSeatLeakage,
          valveStemSize: n.valveStemSize,
          valveCv: n.valveCv,
          valveDescription:
            n.valveDescription ||
            joinNonEmpty([
              n.valveBrand,
              n.valveSeries,
              n.valveSize,
              n.valveRating,
              n.valveEndConnection,
              n.valveStemSize,
              n.valveBodyMaterial,
              n.valveBonnet,
              n.valveTrim,
              n.valveSeatLeakage,
              n.valveCv,
            ]),
          actuatorBrand: n.actuatorBrand,
          actuatorSize: n.actuatorSize,
          actuatorSeries: n.actuatorSeries,
          handwheel: n.handwheel,
          actuatorFailurePosition: n.actuatorFailurePosition,
          actuatorDescription:
            n.actuatorDescription ||
            joinNonEmpty([
              n.actuatorBrand,
              n.actuatorSeries,
              n.actuatorSize,
              n.actuatorFailurePosition,
              n.handwheel,
              n.stroke,
            ]),
          positionerBrand: n.positionerBrand,
          positionerModel: n.positionerModel,
          positionerDescription:
            n.positionerDescription ||
            joinNonEmpty([n.positionerBrand, n.positionerModel]),
          sovBrand: n.sovBrand,
          sovModel: n.sovModel,
          sovQty: n.sovQty,
          sovDescription:
            n.sovDescription ||
            joinNonEmpty([
              n.sovBrand,
              n.sovModel,
              n.sovQty === null ? '' : String(n.sovQty),
            ]),
          lsBrand: n.lsBrand,
          lsModel: n.lsModel,
          lsQty: n.lsQty,
          lsDescription:
            n.lsDescription ||
            joinNonEmpty([
              n.lsBrand,
              n.lsModel,
              n.lsQty === null ? '' : String(n.lsQty),
            ]),
          tripValveBrand: n.tripValveBrand,
          tripValveModel: n.tripValveModel,
          tripValveDescription:
            n.tripValveDescription ||
            joinNonEmpty([n.tripValveBrand, n.tripValveModel]),
          vbBrand: n.vbBrand,
          vbModel: n.vbModel,
          vbQty: n.vbQty,
          vbDescription:
            n.vbDescription ||
            joinNonEmpty([
              n.vbBrand,
              n.vbModel,
              n.vbQty === null ? '' : String(n.vbQty),
            ]),
          qeBrand: n.qeBrand,
          qeModel: n.qeModel,
          qeQty: n.qeQty,
          qeDescription:
            n.qeDescription ||
            joinNonEmpty([
              n.qeBrand,
              n.qeModel,
              n.qeQty === null ? '' : String(n.qeQty),
            ]),
          regulatorBrand: n.regulatorBrand,
          regulatorModel: n.regulatorModel,
          regulatorDescription:
            n.regulatorDescription ||
            joinNonEmpty([n.regulatorBrand, n.regulatorModel]),
          pilotBrand: n.pilotBrand,
          pilotModel: n.pilotModel,
          pilotQty: n.pilotQty,
          pilotDescription:
            n.pilotDescription ||
            joinNonEmpty([
              n.pilotBrand,
              n.pilotModel,
              n.pilotQty === null ? '' : String(n.pilotQty),
            ]),
          stroke: n.stroke,
          signalComparatorBrand: n.signalComparatorBrand,
          signalComparatorModel: n.signalComparatorModel,
          signalComparatorDescription:
            n.signalComparatorDescription ||
            joinNonEmpty([n.signalComparatorBrand, n.signalComparatorModel]),
          parts: n.parts,
          valveRating: n.valveRating,
          deviceId,
          factoryId: body.factoryId,
          updateBy: user.account,
        };
        if (existing) {
          await this.prismaService.client.valve.update({
            where: { id: existing.id },
            data,
          });
          updated += 1;
        } else {
          await this.prismaService.client.valve.create({ data });
          created += 1;
        }
      } catch (err) {
        skipped.push({
          row: rowNumber,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Why: 旧实现把每行 valve 写入失败静默吞进 skipped + 前端只看 HTTP 201 → 用户看到
    // "导入成功" 但 valve 表实际为空(卡博特 xlsx 现场复现)。后端不打日志的话生产侧无从排查,
    // 这里强制把每次 import 的摘要 + skipped 原因落 winston 日志,便于线上 grep 定位。
    this.logger.log(
      `[factory.import] factoryId=${body.factoryId} total=${xlsx.length} created=${created} updated=${updated} skipped=${skipped.length}`,
    );
    if (skipped.length > 0) {
      // slice 100 兜底:防止超大文件全部失败时日志爆炸
      this.logger.warn(
        `[factory.import] factoryId=${body.factoryId} skippedRows=${JSON.stringify(skipped.slice(0, 100))}`,
      );
    }

    return {
      success: true,
      total: xlsx.length,
      created,
      updated,
      skipped: skipped.length,
      skippedRows: skipped,
    };
  }

  async getChartData(id: number) {
    const valveBrandGroup = (
      await this.prismaService.client.valve.groupBy({
        by: ['valveBrand'],
        _count: true,
        where: { NOT: { valveBrand: '' }, factoryId: id },
      })
    ).map((item) => ({ name: item.valveBrand, value: item._count }));
    const valveTotal = await this.prismaService.client.valve.count({
      where: { factoryId: id },
    });

    const positionerModelGroup = (
      await this.prismaService.client.valve.groupBy({
        by: ['positionerModel'],
        _count: true,
        where: { NOT: { positionerModel: '' }, factoryId: id },
      })
    ).map((item) => ({ name: item.positionerModel, value: item._count }));

    //  根据月份分组统计分析任务数量
    const taskGroupByYear = await Promise.all(
      getLast12Months().map(async ({ start, end, label }) => ({
        name: label,
        value: await this.prismaService.client.analysisTask.count({
          where: { factoryId: id, createdAt: { gte: start, lte: end } },
        }),
      })),
    );

    // 根据月份分组统计维修工单数量
    const maintenanceWorkOrderGroupByYear = await Promise.all(
      getLast12Months().map(async ({ start, end, label }) => ({
        name: label,
        value: await this.prismaService.client.workOrder.count({
          where: {
            factoryId: id,
            type: 1,
            createdAt: { gte: start, lte: end },
          },
        }),
      })),
    );
    // 根据月份分组统计服务工单数量
    const serviceWorkOrderGroupByYear = await Promise.all(
      getLast12Months().map(async ({ start, end, label }) => ({
        name: label,
        value: await this.prismaService.client.workOrder.count({
          where: {
            factoryId: id,
            type: 0,
            createdAt: { gte: start, lte: end },
          },
        }),
      })),
    );

    // 获取30天内创建的维修工单
    const maintenanceWorkOrderList = (
      await this.prismaService.client.workOrder.findMany({
        where: {
          factoryId: id,
          type: 1,
          createdAt: {
            gte: dayjs().subtract(365, 'day').toISOString(),
            lte: dayjs().toISOString(),
          },
        },
        include: { factory: true, valve: true },
        orderBy: { createdAt: 'desc' },
      })
    ).map((item) => {
      return {
        ...item,
        createdAt: dayjs(item.createdAt).format('YYYY-MM-DD HH:mm:ss'),
        updatedAt: dayjs(item.updatedAt).format('YYYY-MM-DD HH:mm:ss'),
      };
    });
    // 获取30天内创建的现场工单
    const serviceWorkOrderList = (
      await this.prismaService.client.workOrder.findMany({
        where: {
          factoryId: id,
          type: 0,
          createdAt: {
            gte: dayjs().subtract(365, 'day').toISOString(),
            lte: dayjs().toISOString(),
          },
        },
        include: { factory: true, valve: true },
        orderBy: { createdAt: 'desc' },
      })
    ).map((item) => {
      return {
        ...item,
        createdAt: dayjs(item.createdAt).format('YYYY-MM-DD HH:mm:ss'),
        updatedAt: dayjs(item.updatedAt).format('YYYY-MM-DD HH:mm:ss'),
      };
    });
    // 获取30天内创建的分析任务
    const taskList = (
      await this.prismaService.client.analysisTask.findMany({
        where: {
          factoryId: id,
          createdAt: {
            gte: dayjs().subtract(365, 'day').toISOString(),
            lte: dayjs().toISOString(),
          },
        },
        include: { factory: true },
        orderBy: { createdAt: 'desc' },
      })
    ).map((item) => {
      return {
        ...item,
        createdAt: dayjs(item.createdAt).format('YYYY-MM-DD HH:mm:ss'),
        updatedAt: dayjs(item.updatedAt).format('YYYY-MM-DD HH:mm:ss'),
      };
    });

    return {
      valveTotal,
      valveBrandGroup,
      positionerModelGroup,
      taskGroupByYear,
      maintenanceWorkOrderGroupByYear,
      serviceWorkOrderGroupByYear,
      maintenanceWorkOrderList,
      serviceWorkOrderList,
      taskList,
    };
  }

  async getChartData2(body: chartDto) {
    // const { deviceId } = body;
    // const result = mockValve.detail;
    // console.log(deviceId);
    // if (deviceId === 1) {
    //   result.alertIndicator = [];
    // }
    const result = (
      await firstValueFrom(
        this.httpService.post(
          'http://localhost:5050/api/report/valveCategoricalStatistics',
          body,
        ),
      )
    ).data.detail;
    return result;
  }

  async findReport(reportData: reportDto) {
    let name = '导入的';
    console.log(reportData);
    let valveIdList: number[] = [];
    if (reportData.valveTags?.length) {
      const valveIds = await this.prismaService.client.valve.findMany({
        where: {
          tag: { in: reportData.valveTags },
          factoryId: reportData.factoryId,
        },
        select: { id: true },
      });
      valveIdList = valveIds.map((item) => item.id);
    } else if (reportData.factoryId) {
      const factory = await this.prismaService.client.factory.findUnique({
        where: { id: reportData.factoryId },
      });
      name = factory.name;
    } else if (reportData.analysisTaskId) {
      const analysisTask =
        await this.prismaService.client.analysisTask.findUnique({
          where: { id: reportData.analysisTaskId },
        });
      name = analysisTask.name;
    }
    try {
      const params = {
        ...reportData,
        valveIdList,
      };
      this.logger.log('获取报告数据参数', JSON.stringify(params));
      let result: any;
      // 如果是 watch 模式，则使用 mock 数据
      if (process.env.npm_lifecycle_script?.includes('watch')) {
        result = mockReport;
      } else {
        result = (
          await firstValueFrom(
            this.httpService.post(
              'http://localhost:5050/api/factoryReport',
              params,
            ),
          )
        ).data.detail;
        this.logger.log('获取报告数据', result);
      }
      // console.log(scoreDistribution);
      // 从 public 文件夹获取 docx 模板文件
      if (reportData.type === 1) {
        const data = readFileSync(
          'public/vcm_report_template_cn.docx',
          'binary',
        );
        const docBuffer = await patchDocument({
          outputType: 'nodebuffer',
          data,
          patches: {
            report_time: {
              type: PatchType.PARAGRAPH,
              children: [
                new TextRun({ text: dayjs().format('YYYY年MM月DD日') }),
              ],
            },
            report_for: {
              type: PatchType.PARAGRAPH,
              children: [new TextRun({ text: name })],
            },
            chart_valves_health_overview: chart_valves_health_overview(
              result.scoreDistribution,
            ),
            chart_values_alarm_overivew: chart_values_alarm_overivew(
              result.valveOverallStatus,
            ),
            table_alarm_new: table_alarm(result.newProblem),
            table_alarm_known: table_alarm(result.oldProblem),
            chart_valves_quarter: chart_valves_quarter(
              result.valveQuarterStatus,
            ),
            table_valves_health_month: table_valves_health_month(
              result.valveQuarterStatusTrend,
            ),
            detail_valves_alarm: detail_valves_alarm(result.valveDetails),
            // table_dynamic_control_month: table_dynamic_control_month(
            //   result.valveDynamicControl,
            // ),
            table_valves_travel_month: table_valves_travel_month(
              result.valveTravelHistoryRecord as ValveTravelHistoryRecord,
            ),
            table_cyclecount_travelaccumulate:
              table_cyclecount_travelaccumulate(result.cycleAccumulation),
          },
        });

        const streamOption = {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document; charset=utf-8',
          disposition: `attachment; filename*=UTF-8''${encodeURIComponent(
            `${dayjs().format('YYYY-MM-DD')} ${name}阀门报告.docx`,
          )}`,
        };
        console.log('导出报告', streamOption, docBuffer);
        return new StreamableFile(docBuffer as any, streamOption);
      } else if (reportData.type === 2) {
        console.log('导出问题数据详情', result.valveDetails);
        const des: ValveDetailItem[] = [];
        result.valveDetails.map((item: ValveDetail) => {
          des.push(...item.items);
        });
        return des;
      }
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('获取数据失败, 请联系技术人员');
    }
  }

  findOne(id: number) {
    return this.prismaService.client.factory.findUnique({ where: { id } });
  }

  update(id: number, user: ActiveUserData, updateFactoryDto: UpdateFactoryDto) {
    return this.prismaService.client.factory.update({
      where: { id },
      data: { ...updateFactoryDto, updateBy: user.account },
    });
  }

  async remove(user: ActiveUserData, id: number, ip: string) {
    const factory = await this.prismaService.client.factory.delete({
      where: { id },
    });
    this.eventEmitter.emit('delete', {
      title: `删除ID为${id}, 名称为${factory.name}的工厂`,
      businessType: 2,
      module: '工厂管理',
      account: user.account,
      ip,
    });
    return '删除成功';
  }

  async removeAll(user: ActiveUserData, ip: string) {
    await this.prismaService.client.factory.deleteMany({});
    this.eventEmitter.emit('delete', {
      title: `删除所有工厂`,
      businessType: 2,
      module: '工厂管理',
      account: user.account,
      ip,
    });
    return '删除成功';
  }
}
