import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConsumes,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { CurriculumService } from './curriculum.service';
import { GetCurriculumQueryDto } from './dto/get-curriculum-query.dto';
import { UploadCurriculumDto } from './dto/upload-curriculum.dto';
import { SetSelectionDto } from './dto/set-selection.dto';
import type { ApiResponseDto } from 'src/common/dto/api-response.dto';
import { MongoIdPipe } from 'src/common/pipes/mongo-id.pipe';
import { Types } from 'mongoose';

@ApiCookieAuth('ACCESS_TOKEN')
@Controller('curriculum')
@UseGuards(AuthGuard)
export class CurriculumController {
  constructor(private readonly curriculumService: CurriculumService) {}

  @ApiOperation({
    summary:
      'Retrieves curriculum items for a subject scoped to a household/student',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired.',
  })
  @ApiForbiddenResponse({
    description: 'Authenticated user does not own the requested household.',
  })
  @ApiBadRequestResponse({
    description: 'Missing or invalid query parameters.',
  })
  @Get()
  async getCurriculumItems(
    @Query() query: GetCurriculumQueryDto,
    @CurrentUser() user: Record<string, unknown> & { sub?: string },
  ): Promise<ApiResponseDto<unknown[]>> {
    const cognitoSub = user?.sub;
    if (!cognitoSub || typeof cognitoSub !== 'string') {
      throw new BadRequestException('Not authenticated');
    }

    const data = await this.curriculumService.getCurriculumItems({
      subjectId: query.subjectId,
      householdId: query.householdId,
      studentId: query.studentId,
      cognitoSub,
    });

    return {
      message: 'Curriculum items retrieved successfully',
      data,
    };
  }

  @ApiOperation({
    summary: 'Uploads a curriculum file for a subject',
  })
  @ApiConsumes('multipart/form-data')
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired.',
  })
  @ApiForbiddenResponse({
    description: 'Authenticated user does not own the specified household.',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid file type, file too large, invalid subject, or invalid student.',
  })
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  @UseGuards(AuthGuard)
  async uploadCurriculumItem(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UploadCurriculumDto,
    @CurrentUser() user: Record<string, unknown> & { sub?: string },
  ): Promise<ApiResponseDto<unknown>> {
    const cognitoSub = user?.sub;
    if (!cognitoSub || typeof cognitoSub !== 'string') {
      throw new BadRequestException('Not authenticated');
    }

    if (!file) {
      throw new BadRequestException('File is required.');
    }

    const data = await this.curriculumService.uploadCurriculumItem({
      file,
      subjectId: body.subjectId,
      householdId: body.householdId,
      studentId: body.studentId,
      cognitoSub,
    });

    return {
      message: 'Curriculum item uploaded successfully',
      data,
    };
  }

  @ApiOperation({
    summary: 'Deletes a curriculum item by ID',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired.',
  })
  @ApiForbiddenResponse({
    description:
      'Authenticated user does not own the curriculum item household.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid curriculum item ID format.',
  })
  @ApiNotFoundResponse({
    description: 'Curriculum item not found.',
  })
  @Delete(':id')
  async deleteCurriculumItem(
    @Param('id') id: string,
    @CurrentUser() user: Record<string, unknown> & { sub?: string },
  ): Promise<ApiResponseDto<Record<string, never>>> {
    const cognitoSub = user?.sub;
    if (!cognitoSub || typeof cognitoSub !== 'string') {
      throw new BadRequestException('Not authenticated');
    }

    await this.curriculumService.deleteCurriculumItem({ id, cognitoSub });

    return {
      message: 'Curriculum item deleted successfully',
      data: {},
    };
  }

  @ApiOperation({
    summary: 'Downloads a stored curriculum file by item ID',
  })
  @ApiNotFoundResponse({
    description: 'Curriculum item not found or file is missing from storage.',
  })
  @Get('download/:id')
  async downloadCurriculumFile(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.curriculumService.getFileStream(id);

    if (!result) {
      throw new NotFoundException(
        'Curriculum file not found or no longer available.',
      );
    }

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(result.fileName)}"`,
    );
    result.stream.pipe(res);
  }

  @ApiOperation({
    summary: 'Sets the curriculum selection for a student and subject',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired.',
  })
  @ApiForbiddenResponse({
    description: 'Student does not belong to the authenticated user household.',
  })
  @ApiBadRequestResponse({
    description:
      'Invalid curriculum item ID or student not enrolled in subject.',
  })
  @Put('selection')
  async setSelection(
    @Body() body: SetSelectionDto,
    @CurrentUser() user: Record<string, unknown> & { sub?: string },
  ): Promise<ApiResponseDto<unknown>> {
    const cognitoSub = user?.sub;
    if (!cognitoSub || typeof cognitoSub !== 'string') {
      throw new BadRequestException('Not authenticated');
    }

    const data = await this.curriculumService.setSelection({
      subjectId: body.subjectId,
      studentId: body.studentId,
      curriculumItemId: body.curriculumItemId,
      cognitoSub,
    });

    return {
      message: 'Selection saved successfully',
      data,
    };
  }

  @ApiOperation({
    summary: 'Gets the curriculum selection for a student and subject',
  })
  @ApiUnauthorizedResponse({
    description: 'Access token is missing, invalid, or expired.',
  })
  @ApiForbiddenResponse({
    description: 'Student does not belong to the authenticated user household.',
  })
  @Get('selection')
  async getSelection(
    @Query('studentId', MongoIdPipe) studentId: Types.ObjectId,
    @Query('subjectId', MongoIdPipe) subjectId: Types.ObjectId,
    @CurrentUser() user: Record<string, unknown> & { sub?: string },
  ): Promise<ApiResponseDto<unknown>> {
    const cognitoSub = user?.sub;
    if (!cognitoSub || typeof cognitoSub !== 'string') {
      throw new BadRequestException('Not authenticated');
    }

    const data = await this.curriculumService.getSelection({
      subjectId,
      studentId,
      cognitoSub,
    });

    return {
      message: 'Selection retrieved successfully',
      data,
    };
  }
}
