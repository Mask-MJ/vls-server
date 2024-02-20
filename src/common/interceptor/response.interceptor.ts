import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import * as dayjs from 'dayjs';
import { Observable, map } from 'rxjs';

@Injectable()
export class FormatResponse implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        return Array.isArray(data)
          ? data.map((item) => changeTime(item))
          : changeTime(data);
      }),
    );
  }
}

function changeTime(data: any) {
  if (!data) return [];
  const { createdAt, updatedAt, children } = data;

  createdAt &&
    (data.createdAt = dayjs(createdAt).format('YYYY-MM-DD HH:mm:ss'));
  updatedAt &&
    (data.updatedAt = dayjs(updatedAt).format('YYYY-MM-DD HH:mm:ss'));
  children && (data.children = children.map((item: any) => changeTime(item)));

  return data;
}
