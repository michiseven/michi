import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { GenerateTripDto } from './dto/generate-trip.dto';
import { PatchTripStopsDto } from './dto/patch-trip-stops.dto';
import type { TripApiResponse } from './trip-response';
import { TripsService } from './trips.service';

@Controller('trips')
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  @Post('generate')
  generate(@Body() dto: GenerateTripDto): Promise<TripApiResponse> {
    return this.trips.generate(dto);
  }

  @Get(':id')
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<TripApiResponse> {
    return this.trips.get(id);
  }

  @Patch(':id/stops')
  patchStops(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: PatchTripStopsDto,
  ): Promise<TripApiResponse> {
    return this.trips.patchStops(id, dto);
  }
}
