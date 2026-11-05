import {
  JSON参数解析插件,
  常用接口返回器,
  接口,
  接口逻辑,
  计算接口逻辑JSON参数,
  计算接口逻辑正确结果,
  计算接口逻辑错误结果,
} from '@lsby/net-core'
import { Left, Right } from '@lsby/ts-fp-data'
import { z } from 'zod'
import { 股票行情管理器 } from '../../../../model/stock/stock-market'

let 接口路径 = '/api/project/stock/bars' as const
let 接口方法 = 'post' as const

let 接口逻辑实现 = 接口逻辑.空逻辑().绑定(
  接口逻辑.构造(
    [
      new JSON参数解析插件(
        z
          .object({
            symbol: z.string().min(1),
            count_days: z.number().default(30),
            frequency: z.string().default('1d'),
            start_time: z.string().optional(),
            end_time: z.string().optional(),
          })
          .strict(),
        {},
      ),
    ],
    async (参数) => {
      try {
        let 数据组 = await 股票行情管理器
          .获得单例()
          .获得历史K线({
            symbol: 参数.json.symbol,
            countDays: 参数.json.count_days,
            frequency: 参数.json.frequency,
            startTime: 参数.json.start_time,
            endTime: 参数.json.end_time,
          })
        return new Right({ items: 数据组 })
      } catch (错误) {
        let 消息 = 错误 instanceof Error ? 错误.message : '获取K线失败'
        return new Left(消息 as '获取K线失败')
      }
    },
  ),
)

type _接口逻辑JSON参数 = 计算接口逻辑JSON参数<typeof 接口逻辑实现>
type _接口逻辑错误返回 = 计算接口逻辑错误结果<typeof 接口逻辑实现>
type _接口逻辑正确返回 = 计算接口逻辑正确结果<typeof 接口逻辑实现>

let 接口错误类型描述 = z.string()
let 接口正确类型描述 = z
  .object({
    items: z.array(
      z.object({
        symbol: z.string(),
        eob: z.string(),
        open: z.number(),
        close: z.number(),
        high: z.number(),
        low: z.number(),
        volume: z.number(),
        amount: z.number(),
      }),
    ),
  })
  .strip()

export default new 接口(接口路径, 接口方法, 接口逻辑实现, new 常用接口返回器(接口错误类型描述, 接口正确类型描述), {
  浏览器支持: '纯前端',
})

export let 查询历史K线接口 = 接口逻辑实现.获得最后接口()
