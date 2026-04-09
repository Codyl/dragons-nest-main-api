import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  MAX_GRADE_ORDINAL,
  MIN_GRADE_ORDINAL,
} from 'src/users/utils/homeschool-grade-order';
import type { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import {
  DiscoveryService,
  type DiscoveryTeacherRow,
} from './discovery.service';

@ApiCookieAuth('ACCESS_TOKEN')
@Controller('discovery')
@UseGuards(AuthGuard)
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @ApiOperation({
    summary:
      'List teaching adults whose offerings match a sliding-window grade filter (comma-separated ordinals 0–13).',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired.',
  })
  @Get('teachers')
  async getTeachers(
    @Query('gradeOrdinals') gradeOrdinalsRaw: string,
  ): Promise<ApiResponseDto<DiscoveryTeacherRow[]>> {
    if (!gradeOrdinalsRaw?.trim()) {
      throw new BadRequestException('gradeOrdinals query is required');
    }

    const parts = gradeOrdinalsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const ordinals = parts.map((p) => Number.parseInt(p, 10));
    if (
      ordinals.length === 0 ||
      ordinals.some(
        (n) =>
          !Number.isFinite(n) || n < MIN_GRADE_ORDINAL || n > MAX_GRADE_ORDINAL,
      )
    ) {
      throw new BadRequestException(
        `Each grade ordinal must be ${MIN_GRADE_ORDINAL}–${MAX_GRADE_ORDINAL}`,
      );
    }

    const expanded =
      this.discoveryService.collectOrdinalsFromSlidingWindows(ordinals);
    const data =
      await this.discoveryService.findTeachersByGradeOrdinals(expanded);

    return {
      message: 'Teachers retrieved',
      data,
    };
  }
}
