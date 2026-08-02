// @types/node를 도입하지 않는 리포 방침(server/env.ts 참조)에 맞춘 최소 Node 내장모듈 선언.
// seeds.ts의 fs 기반 JSON 로딩에 필요한 API만 선언한다.
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf-8'): string;
}
declare module 'node:path' {
  export function join(...paths: string[]): string;
}
