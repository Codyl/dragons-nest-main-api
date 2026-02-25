import { Controller, Get, Body, Patch, Param, Delete } from '@nestjs/common';
import { MeService } from './me.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { Types } from 'mongoose';

@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get(':id')
  findMe(@Param('id') _id: Types.ObjectId) {
    return this.meService.getMe(_id);
  }

  @Patch(':id')
  updateMe(@Param('id') _id: Types.ObjectId, @Body() updateMeDto: UpdateMeDto) {
    return this.meService.updateMe(_id, updateMeDto);
  }

  @Delete(':id')
  deleteMe(@Param('id') _id: Types.ObjectId) {
    return this.meService.deleteMe(_id);
  }
}
