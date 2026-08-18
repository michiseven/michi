import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { GeoPoint } from '../../database/entities';
import type { ProviderPlaceRecord } from './place-provider';

export interface NormalizedPlace {
  source: string;
  sourcePlaceId: string;
  name: string;
  category: string | null;
  address: string | null;
  roadAddress: string | null;
  location: GeoPoint | null;
  district: string | null;
  rawCategory: string | null;
  rawPayload: Record<string, unknown>;
}

export interface NaverLocalItem {
  title?: unknown;
  link?: unknown;
  category?: unknown;
  description?: unknown;
  telephone?: unknown;
  address?: unknown;
  roadAddress?: unknown;
  mapx?: unknown;
  mapy?: unknown;
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .trim();
}

function naverCoordinate(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }
  const integer = Number(value);
  if (!Number.isFinite(integer)) {
    return null;
  }
  const coordinate = integer / 10_000_000;
  return coordinate >= min && coordinate <= max ? coordinate : null;
}

function deriveSourceId(item: NaverLocalItem): string {
  const fingerprint = [
    optionalString(item.title),
    optionalString(item.address),
    optionalString(item.roadAddress),
    optionalString(item.mapx),
    optionalString(item.mapy),
  ].join('|');
  return `derived:${createHash('sha256').update(fingerprint).digest('hex')}`;
}

function normalizeCategory(rawCategory: string | null): string | null {
  if (!rawCategory) {
    return null;
  }
  const leaf = rawCategory.split('>').at(-1)?.trim().toLowerCase() ?? '';
  if (/카페|커피/.test(leaf)) return 'cafe';
  if (/한식|고기|육류|음식점|restaurant/.test(leaf)) return 'restaurant';
  if (/패션|의류|편집|쇼핑/.test(leaf)) return 'shopping';
  if (/공원|자연/.test(leaf)) return 'park';
  if (/미술관|박물관|전시/.test(leaf)) return 'culture';
  return leaf.length > 0 ? leaf : null;
}

function districtFromAddress(address: string | null): string | null {
  if (!address) return null;
  const district = address.split(/\s+/).find((part) => part.endsWith('구'));
  return district ?? null;
}

export function normalizeNaverLocalItem(item: NaverLocalItem): ProviderPlaceRecord | null {
  const rawTitle = optionalString(item.title);
  const address = optionalString(item.address);
  const roadAddress = optionalString(item.roadAddress);
  if (!rawTitle || ![address, roadAddress].some((value) => value?.startsWith('서울'))) {
    return null;
  }

  const longitude = naverCoordinate(item.mapx, -180, 180);
  const latitude = naverCoordinate(item.mapy, -90, 90);
  const link = optionalString(item.link);

  return {
    provider: 'naver-local',
    providerMode: 'live',
    sourcePlaceId: link ?? deriveSourceId(item),
    sourcePlaceIdKind: link ? 'provider' : 'derived',
    name: stripHtml(rawTitle),
    rawCategory: optionalString(item.category),
    address,
    roadAddress,
    longitude,
    latitude,
    rawPayload: { ...item },
  };
}

@Injectable()
export class PlaceNormalizer {
  normalize(record: ProviderPlaceRecord): NormalizedPlace {
    const location =
      record.longitude !== null && record.latitude !== null
        ? {
            type: 'Point' as const,
            coordinates: [record.longitude, record.latitude] as [number, number],
          }
        : null;
    return {
      source: record.provider,
      sourcePlaceId: record.sourcePlaceId,
      name: record.name,
      category: normalizeCategory(record.rawCategory),
      address: record.address,
      roadAddress: record.roadAddress,
      location,
      district: districtFromAddress(record.roadAddress ?? record.address),
      rawCategory: record.rawCategory,
      rawPayload: {
        sourceRecord: { ...record.rawPayload },
        normalization: {
          providerMode: record.providerMode,
          sourcePlaceIdKind: record.sourcePlaceIdKind,
        },
      },
    };
  }
}
