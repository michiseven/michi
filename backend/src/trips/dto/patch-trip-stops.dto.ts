import { IsArray, IsIn, IsOptional, IsUUID } from 'class-validator';

export class PatchTripStopsDto {
  @IsIn(['remove', 'reorder', 'recalculate'])
  action!: 'remove' | 'reorder' | 'recalculate';

  @IsOptional()
  @IsUUID()
  stopId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  stopIds?: string[];
}
