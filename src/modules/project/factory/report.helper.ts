import * as echarts from 'echarts';
import {
  AlignmentType,
  BorderStyle,
  ImageRun,
  Paragraph,
  PatchType,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  VerticalMergeType,
  WidthType,
} from 'docx';
import { readFileSync } from 'fs';
import dayjs from 'dayjs';
import { find } from 'lodash';

// 去年份: 兼容 "2023年3月" / "2025-07" / "2025/07" → "3月" / "07" / "07"
export const stripYear = (s: string | number | null | undefined): string =>
  String(s ?? '').replace(/^\d{4}[年\-/]/, '');

// 深色背景 (紫/红) 上文字需改白色以保证可读性
const DARK_SHADING = new Set(['#6e298d', '#ff0000']);
export const textColorForShading = (shading: string | null | undefined): string =>
  DARK_SHADING.has(String(shading || '').toLowerCase()) ? '#ffffff' : '#000000';

// 窗边框 (行程历史 / 周期计数页要求)
const BOX_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const TABLE_BORDERS = {
  top: BOX_BORDER,
  bottom: BOX_BORDER,
  left: BOX_BORDER,
  right: BOX_BORDER,
  insideHorizontal: BOX_BORDER,
  insideVertical: BOX_BORDER,
};

interface ReportProblemTable {
  tag: string;
  name: string;
  description: string;
  time: string;
}
export interface ValveDetail {
  tag: string;
  items: ValveDetailItem[];
}
export interface ValveDetailItem {
  sort: string;
  tag: string;
  description: string;
  risk: string;
  measures: string;
  name: string;
  plot?: {
    times: string[];
    upperLimit: number;
    lowerLimit: number;
    dataLine: number[];
    predictionLine: {
      linearRegression: number[];
    };
    auxiliaryLine: {
      averageValue: number[];
    };
  };
}
interface CycleAccumulation {
  number: number;
  tag: string;
  data: {
    time: string;
    cycleCount: { name: string; value: string | number; style: any };
    dailyMovementCount: { name: string; value: string | number; style: any };
    travelAccumulator: { name: string; value: string | number; style: any };
    amplitudePerAction: { name: string; value: string | number; style: any };
  }[];
}
export interface ValveTravelHistoryRecord {
  records: Record[][];
  descriptions: string[];
}
export interface Record {
  key: string;
  name: string;
  value: string;
  style: any;
}

const renderTableHeaderRow = (data: string[]) => {
  const children = data.map((item) => {
    return new TableCell({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: item, color: '#ffffff' })],
        }),
      ],
      verticalAlign: VerticalAlign.CENTER,
      shading: {
        fill: 'b79c2f',
        type: ShadingType.SOLID,
        color: '#43545D',
      },
    });
  });
  return new TableRow({ children });
};

const getTableCellStyle = (value: number, type: number) => {
  if (type === 1) {
    if (value >= 85) {
      return '#00b050';
    } else if (value < 85 && value >= 73) {
      return '#ffff00';
    } else if (value < 73 && value > 0) {
      return '#ff0000';
    } else {
      return '#ffffff';
    }
  } else if (type === 2) {
    if (value >= 80) {
      return '#00b050';
    } else if (value < 80 && value >= 73) {
      return '#ffff00';
    } else if (value < 73 && value > 0) {
      return '#ff0000';
    } else {
      return '#6e298d';
    }
  }
};

export interface AlarmRowGroup {
  tag: string;
  time: string;
  problems: string[];
}

// 把多条 (tag, time, name) 按"同位号同日期"折叠成组，保留首次出现顺序
export function groupAlarmRows(data: ReportProblemTable[]): AlarmRowGroup[] {
  const groups = new Map<string, AlarmRowGroup>();
  for (const r of data) {
    const key = `${r.tag}|${r.time}`;
    if (!groups.has(key)) {
      groups.set(key, { tag: r.tag, time: r.time, problems: [] });
    }
    groups.get(key)!.problems.push(r.name);
  }
  return Array.from(groups.values());
}

// 问题表格 — 同一阀门同一日期的多个问题：序号/位号/日期 cell vMerge，问题描述每个独占一行
export const table_alarm = (data: ReportProblemTable[]) => {
  if (data.length === 0) {
    return {
      type: PatchType.PARAGRAPH,
      children: [new TextRun({ text: ' ' })],
    };
  }
  const groups = groupAlarmRows(data);
  const rows: TableRow[] = [];
  groups.forEach((group, groupIdx) => {
    group.problems.forEach((problem, problemIdx) => {
      const isFirst = problemIdx === 0;
      const vMerge = isFirst
        ? VerticalMergeType.RESTART
        : VerticalMergeType.CONTINUE;
      rows.push(
        new TableRow({
          children: [
            new TableCell({
              verticalMerge: vMerge,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({ text: isFirst ? `${groupIdx + 1}` : '' }),
                  ],
                }),
              ],
            }),
            new TableCell({
              verticalMerge: vMerge,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isFirst ? group.tag : '' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 4000, type: WidthType.DXA },
              children: [new Paragraph({ text: problem })],
            }),
            new TableCell({
              verticalMerge: vMerge,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isFirst ? group.time : '' })],
                }),
              ],
            }),
          ],
        }),
      );
    });
  });
  return {
    type: PatchType.DOCUMENT,
    children: [
      new Table({
        rows: [
          renderTableHeaderRow(['序号', '阀门位号', '问题描述', '报告日期']),
          ...rows,
        ],
      }),
    ],
  };
};
// 健康饼图
export const chart_valves_health_overview = (
  data: { name: string; value: number }[],
) => {
  const chart = echarts.init(null, null, {
    renderer: 'svg',
    ssr: true,
    width: 250,
    height: 300,
  });
  chart.setOption({
    color: ['#ff0000', '#ffff00', '#00b050', '#00b050', '#00b050'],
    legend: { top: '5%', left: 'center' },
    series: [
      {
        name: 'Access From',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          position: 'inner',
          fontSize: 14,
          color: '#000000',
          formatter: '{c}',
        },
        labelLine: { show: false },
        data,
      },
    ],
  });
  return {
    type: PatchType.PARAGRAPH,
    children: [
      new ImageRun({
        type: 'svg',
        data: Buffer.from(chart.renderToSVGString(), 'utf-8'),
        transformation: { width: 250, height: 300 },
        fallback: {
          type: 'png',
          data: readFileSync('public/linux-png.png'),
        },
      }),
    ],
  };
};
// 告警饼图
export const chart_values_alarm_overivew = (
  data: { name: string; value: number }[],
) => {
  const chart = echarts.init(null, null, {
    renderer: 'svg',
    ssr: true,
    width: 250,
    height: 300,
  });
  chart.setOption({
    color: ['#00b050', '#ff0000'],
    legend: { top: '5%', left: 'center' },
    series: [
      {
        name: 'Access From',
        type: 'pie',
        radius: ['40%', '70%'],
        label: {
          position: 'inner',
          fontSize: 14,
          color: '#000000',
          formatter: '{b}: {c}',
        },
        labelLine: { show: false },
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2,
        },
        data: data.map((item) => {
          return {
            name: item.name,
            value: item.value,
            itemStyle: {
              color: item.name === '正常' ? '#00b050' : '#ff0000',
            },
          };
        }),
      },
    ],
  });
  return {
    type: PatchType.PARAGRAPH,
    children: [
      new ImageRun({
        type: 'svg',
        data: Buffer.from(chart.renderToSVGString(), 'utf-8'),
        transformation: { width: 250, height: 300 },
        fallback: {
          type: 'png',
          data: readFileSync('public/linux-png.png'),
        },
      }),
    ],
  };
};
// 状况状态柱状图
export const chart_valves_quarter = (
  data: { name: string; alert: number; normal: number }[],
) => {
  const names = data.map((item) => item.name);
  const alerts = data.map((item) => item.alert);
  const normals = data.map((item) => item.normal);
  const chart = echarts.init(null, null, {
    renderer: 'svg',
    ssr: true,
    width: 500,
    height: 300,
  });
  chart.setOption({
    color: ['#00b050', '#ff0000'],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    legend: {},
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: [{ type: 'category', data: names }],
    yAxis: [{ type: 'value' }],
    series: [
      {
        name: '正常',
        type: 'bar',
        stack: 'Ad',
        label: {
          show: true,
          position: 'inside',
          color: '#000000',
          formatter: '{c}',
        },
        itemStyle: { color: '#00b050' },
        data: normals,
      },
      {
        name: '告警',
        type: 'bar',
        stack: 'Ad',
        label: {
          show: true,
          position: 'inside',
          color: '#000000',
          formatter: '{c}',
        },
        itemStyle: { color: '#ff0000' },
        data: alerts,
      },
    ],
  });
  return {
    type: PatchType.PARAGRAPH,
    children: [
      new TextRun({ text: ` `, break: 1 }),
      new ImageRun({
        type: 'svg',
        data: Buffer.from(chart.renderToSVGString(), 'utf-8'),
        transformation: { width: 500, height: 300 },
        fallback: {
          type: 'png',
          data: readFileSync('public/linux-png.png'),
        },
      }),
    ],
  };
};
// 阀门健康趋势
export const table_valves_health_month = (
  data: { tag: string; data: { name: string; value: number }[] }[],
) => {
  if (data.length === 0) {
    return {
      type: PatchType.PARAGRAPH,
      children: [new TextRun({ text: ' ' })],
    };
  }
  return {
    type: PatchType.DOCUMENT,
    children: [
      new Table({
        width: {
          size: 9000,
          type: WidthType.DXA,
        },
        rows: [
          renderTableHeaderRow([
            '序号',
            '阀门位号',
            ...data[0].data.map((i) => stripYear(i.name)),
          ]),
          ...data.map((item, index) => {
            return new TableRow({
              children: [
                new TableCell({
                  verticalAlign: VerticalAlign.CENTER,
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [new TextRun({ text: `${index + 1}` })],
                    }),
                  ],
                }),
                new TableCell({
                  verticalAlign: VerticalAlign.CENTER,
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [new TextRun({ text: item.tag })],
                    }),
                  ],
                }),
                ...item.data.map((i) => {
                  return new TableCell({
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: `${i.value}`,
                            color: '#000000',
                          }),
                        ],
                      }),
                    ],
                    shading: {
                      fill: 'b79c2f',
                      type: ShadingType.SOLID,
                      color: getTableCellStyle(i.value, 1),
                    },
                  });
                }),
              ],
            });
          }),
        ],
      }),
    ],
  };
};
// 阀门细节图 ECharts option 构造（纯函数，便于单元测试）
// series 顺序 = 绘制顺序，后绘制在上层：标准线 → 平均值 → 预测线 → 数据线（数据线最上）
// 颜色与前端 (client) ChartModal/workTable 默认 ECharts 调色板对齐：
//   数据线=蓝 / 预测线=绿 / 平均值=黄 / 标准线=红。
// 前端无 itemStyle.color，PDF 这边因 series 顺序重排（B8），必须按 name 显式绑色。
const CHART_COLORS = {
  dataLine: '#5470c6', // ECharts 默认 [0] 蓝
  predictionLine: '#91cc75', // ECharts 默认 [1] 绿
  averageLine: '#fac858', // ECharts 默认 [2] 黄
  standardLine: '#ee6666', // ECharts 默认 [3] 红
} as const;

export function buildAlarmChartOption(
  plot: NonNullable<ValveDetailItem['plot']>,
) {
  const lowerLimit = Number(plot.lowerLimit || 0);
  const upperLimit = Number(plot.upperLimit || 0);
  const rawMax = Math.max(...plot.dataLine, upperLimit);
  const rawMin = Math.min(...plot.dataLine, lowerLimit);
  const labelTop = { show: true, position: 'top' as const, color: '#000000' };
  return {
    legend: { data: ['数据线', '预测线', '平均值', '标准线'] },
    tooltip: { trigger: 'axis' as const },
    xAxis: { type: 'category' as const, data: plot.times },
    yAxis: {
      type: 'value' as const,
      max: Math.ceil(rawMax),
      min: Math.floor(rawMin),
    },
    label: { fontSize: 14 },
    series: [
      {
        type: 'line' as const,
        name: '标准线',
        itemStyle: { color: CHART_COLORS.standardLine },
        lineStyle: { color: CHART_COLORS.standardLine },
        label: labelTop,
        markLine: {
          lineStyle: { color: CHART_COLORS.standardLine },
          data: [
            { name: '下限值', yAxis: lowerLimit },
            { name: '上限值', yAxis: upperLimit },
          ],
        },
      },
      {
        type: 'line' as const,
        name: '平均值',
        itemStyle: { color: CHART_COLORS.averageLine },
        lineStyle: { color: CHART_COLORS.averageLine },
        data: plot.auxiliaryLine.averageValue,
        label: labelTop,
      },
      {
        type: 'line' as const,
        name: '预测线',
        itemStyle: { color: CHART_COLORS.predictionLine },
        lineStyle: { color: CHART_COLORS.predictionLine },
        data: plot.predictionLine.linearRegression,
        label: labelTop,
      },
      {
        type: 'line' as const,
        name: '数据线',
        itemStyle: { color: CHART_COLORS.dataLine },
        lineStyle: { color: CHART_COLORS.dataLine },
        data: plot.dataLine,
        label: labelTop,
      },
    ],
  };
}

// 问题详情列表
export const detail_valves_alarm = (data: ValveDetail[]) => {
  const renderArray = data.map((list, index) => {
    const r = list.items.map((item) => {
      let chart: echarts.ECharts | undefined = undefined;
      // item.plot 不是空对象
      if (
        item.plot &&
        Object.keys(item.plot).length > 0 &&
        item.plot.times &&
        item.plot.dataLine
      ) {
        chart = echarts.init(null, null, {
          renderer: 'svg',
          ssr: true,
          width: 400,
          height: 300,
        });
        chart.setOption(buildAlarmChartOption(item.plot));

        return [
          new TextRun({
            text: `${item.sort}：`,
            bold: true,
            break: 1,
          }),
          new TextRun({ text: `阀门位号：${item.tag}`, break: 1 }),
          new TextRun({
            text: `问题描述：${item.description}`,
            break: 1,
          }),
          new TextRun({ text: `潜在风险：${item.risk}`, break: 1 }),
          new TextRun({ text: `建议措施：${item.measures}`, break: 1 }),
          new TextRun({ text: ` `, break: 1 }),

          chart &&
            new ImageRun({
              type: 'svg',
              data: Buffer.from(chart.renderToSVGString(), 'utf-8'),
              // Why: 与 chart 渲染尺寸一致，避免 500x300 拉伸 400x300 数据图变形
              transformation: { width: 400, height: 300 },
              fallback: {
                type: 'png',
                data: readFileSync('public/linux-png.png'),
              },
            }),
        ];
      }
    });
    const flattenedR = r.flat();
    return [
      new TextRun({
        text: `阀门${index + 1}： ${list.tag || ''}`,
        bold: true,
        size: 28,
        break: 1,
      }),
      ...flattenedR,
      new TextRun({ text: ` `, break: 1 }),
    ];
  });
  const flattenedRenderArray = renderArray.flat();
  return {
    type: PatchType.DOCUMENT,
    children: [
      new Paragraph({
        children: [
          ...flattenedRenderArray,
          new TextRun({ text: ` `, break: 1 }),
        ],
      }),
    ],
  };
};
// 动态控制 性能趋势
export const table_dynamic_control_month = (
  data: {
    tag: string;
    data: { time: string; score: number; description: string }[];
  }[],
) => {
  if (data.length === 0) {
    return {
      type: PatchType.PARAGRAPH,
      children: [new TextRun({ text: ' ' })],
    };
  }
  const times = data[0].data.map((i) => dayjs(i.time).format('YYYY-MM-DD'));
  return {
    type: PatchType.DOCUMENT,
    children: [
      new Table({
        rows: [
          renderTableHeaderRow(['序号', '阀门位号', ...times]),
          ...data.map((item, index) => {
            return new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [new TextRun({ text: `${index + 1}` })],
                    }),
                  ],
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: item.tag })],
                    }),
                  ],
                }),
                ...item.data.map((i) => {
                  return new TableCell({
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: `${i.description}`,
                            color: '#ffffff',
                          }),
                        ],
                      }),
                    ],
                    shading: {
                      fill: 'b79c2f',
                      type: ShadingType.SOLID,
                      color: getTableCellStyle(i.score, 2),
                    },
                  });
                }),
              ],
            });
          }),
        ],
      }),
    ],
  };
};
// 季度阀门行程历史记录
export const table_valves_travel_month = (data: ValveTravelHistoryRecord) => {
  if (data.records.length === 0) {
    return {
      type: PatchType.PARAGRAPH,
      children: [
        new TextRun({
          text: '本次报告，未发现阀门超出有效Cv操作区间问题。',
        }),
      ],
    };
  }
  const tableHeaderRow = data.records[0].map((i) => i.name);
  const renderArray = data.descriptions.map((item) => {
    return new TextRun({ text: item, break: 1 });
  });
  return {
    type: PatchType.DOCUMENT,
    children: [
      new Table({
        borders: TABLE_BORDERS,
        rows: [
          renderTableHeaderRow(tableHeaderRow),
          ...data.records.map((item) => {
            const children: any[] = [];
            for (let i = 0; i < item.length; i++) {
              const cell = find(item, (o) => o.name === tableHeaderRow[i]);
              if (!cell) {
                continue;
              }
              const getCellValue = (cell: Record) => {
                if (
                  ['globeValve', 'rotaryValve', 'butteValve'].includes(cell.key)
                ) {
                  return cell.value ? '✓' : '';
                }
                return cell.value ? cell.value + '' : '';
              };
              children.push(
                new TableCell({
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: getCellValue(cell),
                          color: textColorForShading(cell.style),
                        }),
                      ],
                    }),
                  ],
                  shading: {
                    fill: 'b79c2f',
                    type: ShadingType.SOLID,
                    color: cell.style || '#ffffff',
                  },
                }),
              );
            }
            return new TableRow({ children });
          }),
        ],
      }),

      new Paragraph({
        children: renderArray,
      }),
    ],
  };
};
// 周期计数/行程百分比累积
export const table_cyclecount_travelaccumulate = (
  data: CycleAccumulation[],
) => {
  if (data.length === 0) {
    return {
      type: PatchType.PARAGRAPH,
      children: [new TextRun({ text: ' ' })],
    };
  }
  const times = data[0].data.map((i) => i.time);
  const headerBase = ['序号', '阀门位号'];
  const header = ['循环计数', '日动作次数', '行程累计器', '次动作幅度'];
  // 根据时间生成表头
  const row1 = new TableRow({
    children: [
      ...headerBase.map((item) => {
        return new TableCell({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: item || '', color: '#000000' })],
            }),
          ],
          verticalAlign: VerticalAlign.CENTER,
          shading: {
            fill: 'b79c2f',
            type: ShadingType.SOLID,
            color: '#43545D',
          },
        });
      }),
      ...header.map((item) => {
        return new TableCell({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: item || '', color: '#ffffff' })],
            }),
          ],
          verticalAlign: VerticalAlign.CENTER,
          columnSpan: 3,
          shading: {
            fill: 'b79c2f',
            type: ShadingType.SOLID,
            color: '#43545D',
          },
        });
      }),
    ],
  });
  const timesRow = times.map((item) => {
    return new TableCell({
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: stripYear(item), color: '#ffffff' })],
        }),
      ],
      verticalAlign: VerticalAlign.CENTER,
      columnSpan: 1,
      shading: {
        fill: 'b79c2f',
        type: ShadingType.SOLID,
        color: '#43545D',
      },
    });
  });

  const timesRow2: any[] = [];
  header.map(() => {
    timesRow2.push(...timesRow);
  });

  // https://github.com/dolanmiu/docx/issues/695
  return {
    type: PatchType.DOCUMENT,
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: TABLE_BORDERS,
        rows: [
          row1,
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: '', color: '#ffffff' })],
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: '', color: '#ffffff' })],
                  }),
                ],
              }),
              ...timesRow2,
            ],
          }),
          ...data.map((item) => {
            const children: any[] = [
              new TableCell({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: `${item.number}` })],
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: item.tag || '' })],
                  }),
                ],
              }),
            ];
            // 获取阀门月份数组
            const valveMonth = item.data.map((i) => i.time);
            const valveHeader = [
              'cycleCount',
              'dailyMovementCount',
              'travelAccumulator',
              'amplitudePerAction',
            ];
            // 查找 valveHeader 中 time 对应的数据
            valveHeader.forEach(
              (i: Exclude<keyof CycleAccumulation['data'][0], 'time'>) => {
                // 根据顺序获取对应的月份数据
                valveMonth.forEach((month) => {
                  const cell = find(item.data, (o) => o.time === month);
                  if (!cell) {
                    return;
                  }
                  children.push(
                    new TableCell({
                      children: [
                        new Paragraph({
                          alignment: AlignmentType.CENTER,
                          children: [
                            new TextRun({
                              text: `${cell[i].value || ''}`,
                              color: cell[i].style ? '#000000' : '#000000',
                            }),
                          ],
                        }),
                      ],
                      shading: {
                        fill: 'b79c2f',
                        type: ShadingType.SOLID,
                        color: cell[i].style || '#ffffff',
                      },
                    }),
                  );
                });
              },
            );
            return new TableRow({ children });
          }),
        ],
      }),
    ],
  };
};
