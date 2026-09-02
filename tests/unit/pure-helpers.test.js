// Enterprise-readiness mục 4 -- test hàm logic thuần trong lib/pure-helpers.js.
// import/export (ESM): Vitest tự transform mọi file test qua Vite bất kể "type" trong
// package.json, và bản thân gói "vitest" từ chối bị require() (CJS). lib/pure-helpers.js
// vẫn viết CommonJS (module.exports) như quy ước cả app.
// wh-org không có timeAgoVietnamese (dùng timeSince() riêng, ngoài phạm vi tách này).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getProgressBarColor,
  orgUnitDepth,
  orgUnitLabel,
  formatPersonalTimeAgo,
  sortPersonalItemsCache,
} from '../../lib/pure-helpers.js';

describe('getProgressBarColor', () => {
  it('trả class Bootstrap theo ngưỡng phần trăm', () => {
    expect(getProgressBarColor(100)).toBe('bg-success');
    expect(getProgressBarColor(50)).toBe('bg-primary');
    expect(getProgressBarColor(1)).toBe('bg-warning');
    expect(getProgressBarColor(0)).toBe('bg-secondary');
  });
});

describe('orgUnitDepth / orgUnitLabel', () => {
  const unitsById = new Map([
    ['root', { id: 'root', name: 'Phòng Ban', parent_id: null }],
    ['child', { id: 'child', name: 'Tổ Con', parent_id: 'root' }],
    ['grandchild', { id: 'grandchild', name: 'Nhóm Nhỏ', parent_id: 'child' }],
  ]);

  it('tính đúng độ sâu theo chuỗi parent_id', () => {
    expect(orgUnitDepth('root', unitsById)).toBe(0);
    expect(orgUnitDepth('child', unitsById)).toBe(1);
    expect(orgUnitDepth('grandchild', unitsById)).toBe(2);
  });
  it('không lặp vô hạn khi có chu trình (self-parent)', () => {
    const cyclic = new Map([['a', { id: 'a', name: 'A', parent_id: 'a' }]]);
    expect(orgUnitDepth('a', cyclic)).toBe(1);
  });
  it('gắn tiền tố thụt lề theo độ sâu', () => {
    expect(orgUnitLabel(unitsById.get('grandchild'), unitsById)).toBe('— — Nhóm Nhỏ');
    expect(orgUnitLabel(unitsById.get('root'), unitsById)).toBe('Phòng Ban');
  });
});

describe('formatPersonalTimeAgo', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-02T12:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); });

  it('rỗng khi thiếu hoặc không parse được', () => {
    expect(formatPersonalTimeAgo('')).toBe('');
    expect(formatPersonalTimeAgo('not-a-date')).toBe('');
  });
  it('"vừa xong" dưới 60 giây', () => {
    expect(formatPersonalTimeAgo('2026-09-02T11:59:30Z')).toBe('vừa xong');
  });
  it('trả cụm trần theo đơn vị phù hợp', () => {
    expect(formatPersonalTimeAgo('2026-09-02T11:55:00Z')).toBe('5 phút trước');
    expect(formatPersonalTimeAgo('2026-09-02T09:00:00Z')).toBe('3 giờ trước');
    expect(formatPersonalTimeAgo('2026-08-30T12:00:00Z')).toBe('3 ngày trước');
  });
});

describe('sortPersonalItemsCache', () => {
  it('ghim lên trước, trong mỗi nhóm sắp theo updated_at giảm dần', () => {
    const items = [
      { id: 1, pinned: false, updated_at: '2026-09-01T00:00:00Z' },
      { id: 2, pinned: true, updated_at: '2026-08-01T00:00:00Z' },
      { id: 3, pinned: false, updated_at: '2026-09-02T00:00:00Z' },
      { id: 4, pinned: true, updated_at: '2026-08-15T00:00:00Z' },
    ];
    expect(sortPersonalItemsCache(items).map(i => i.id)).toEqual([4, 2, 3, 1]);
  });
  it('không sửa mảng gốc (immutable)', () => {
    const items = [{ id: 1, pinned: false, updated_at: '2026-01-01' }];
    const sorted = sortPersonalItemsCache(items);
    expect(sorted).not.toBe(items);
  });
});
