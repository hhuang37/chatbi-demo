export type Connection = {state:string;message:string;model?:string|null}
export type Health = {status:string;maas:Connection;model:string;models:string[];default_model:string;database:string;features:{charts:boolean}}
export type Scenario = {name:string;subtitle:string;description:string;currency:string;date_range:string[];suggestions:string[];metrics:Record<string,string>}
export type Table = {columns:string[];rows:Record<string,string|number|null>[];row_count:number;truncated:boolean}
export type ChartSpec = {type:'bar'|'line';labelColumn:string;valueColumn:string;labels:string[];values:number[]}
export type ChatResult = {kind:'query'|'message'|'clarify';answer:string;sql:string|null;table:Table|null;analysis:string|null;chart:null;warnings:string[]}
