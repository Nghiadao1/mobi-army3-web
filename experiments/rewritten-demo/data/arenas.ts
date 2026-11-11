import type { ArenaDef } from '../types';

export const ARENAS: ArenaDef[] = [
  { id: 'green-hills', name: 'Đồi Xanh', subtitle: 'Chiến trường kinh điển', sky: ['#48b9e8', '#d9f6ff'], ground: '#437c32', accent: '#f7d94c', seed: 17, difficulty: 1 },
  { id: 'frozen-bridge', name: 'Cầu Băng', subtitle: 'Gió mạnh, mặt đất hiểm', sky: ['#355b8c', '#d9f2ff'], ground: '#7eb6c8', accent: '#b9f3ff', seed: 41, difficulty: 2 },
  { id: 'desert-temple', name: 'Đền Cổ', subtitle: 'Hẻm núi của các xạ thủ', sky: ['#db7d38', '#ffe1a3'], ground: '#8b572a', accent: '#ffd166', seed: 73, difficulty: 2 },
  { id: 'iron-city', name: 'Thành Phố Sắt', subtitle: 'Đấu trường công nghệ', sky: ['#18243b', '#60708f'], ground: '#39465a', accent: '#22d3ee', seed: 101, difficulty: 3 },
  { id: 'asgard', name: 'Cổng Asgard', subtitle: 'Biệt đội Marvel xuất trận', sky: ['#1d2a56', '#7c3aed'], ground: '#3b2f57', accent: '#facc15', seed: 137, difficulty: 3 },
  { id: 'spider-cave', name: 'Hang Nhện', subtitle: 'Địa hình bị chia cắt', sky: ['#120d20', '#48235e'], ground: '#30223c', accent: '#ef4444', seed: 211, difficulty: 3 },
];
