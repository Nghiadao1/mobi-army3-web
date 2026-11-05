// Khai báo tối thiểu cho node:fs để test đọc file dữ liệu (maps.json) mà không cần @types/node.
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf-8'): string;
  export function existsSync(path: string): boolean;
}
