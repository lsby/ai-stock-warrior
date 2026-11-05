import {
  JSON参数解析插件,
  常用接口返回器,
  接口,
  接口逻辑,
  计算接口逻辑JSON参数,
  计算接口逻辑正确结果,
  计算接口逻辑错误结果,
} from '@lsby/net-core'
import { Right } from '@lsby/ts-fp-data'
import { z } from 'zod'
import { 股票行情管理器 } from '../../../../model/stock/stock-market'

let 接口路径 = '/api/project/stock/instruments' as const
let 接口方法 = 'post' as const

let 接口逻辑实现 = 接口逻辑.空逻辑().绑定(
  接口逻辑.构造(
    [
      new JSON参数解析插件(
        z
          .object({
            exchange: z.enum(['SHSE', 'SZSE']).optional(),
            search: z.string().optional(),
            offset: z.number().default(0),
            limit: z.number().default(100),
          })
          .strict(),
        {},
      ),
    ],
    async (参数) => {
      let 全量列表 = await 股票行情管理器.获得单例().获得标的列表()

      let 过滤结果 = 全量列表
      if (参数.json.exchange !== undefined) {
        过滤结果 = 过滤结果.filter((item) => item.exchange === 参数.json.exchange)
      }

      if (参数.json.search !== undefined && 参数.json.search.trim() !== '') {
        let 关键词 = 参数.json.search.trim().toLowerCase()
        过滤结果 = 过滤结果.filter(
          (item) => item.symbol.toLowerCase().includes(关键词) || item.sec_name.toLowerCase().includes(关键词),
        )
      }

      let 起始 = Math.max(0, 参数.json.offset)
      let 数量 = Math.max(1, 参数.json.limit)
      let 分页项 = 过滤结果.slice(起始, 起始 + 数量)

      return new Right({ total: 过滤结果.length, offset: 起始, limit: 数量, items: 分页项 })
    },
  ),
)

type _接口逻辑JSON参数 = 计算接口逻辑JSON参数<typeof 接口逻辑实现>
type _接口逻辑错误返回 = 计算接口逻辑错误结果<typeof 接口逻辑实现>
type _接口逻辑正确返回 = 计算接口逻辑正确结果<typeof 接口逻辑实现>

let 接口错误类型描述 = z.never()
let 接口正确类型描述 = z
  .object({
    total: z.number(),
    offset: z.number(),
    limit: z.number(),
    items: z.array(z.object({ symbol: z.string(), sec_name: z.string(), exchange: z.string() })),
  })
  .strip()

export default new 接口(接口路径, 接口方法, 接口逻辑实现, new 常用接口返回器(接口错误类型描述, 接口正确类型描述), {
  浏览器支持: '纯前端',
})

export let 查询标的列表接口 = 接口逻辑实现.获得最后接口()
