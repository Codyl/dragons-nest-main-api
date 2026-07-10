import {
  IsNotEmpty,
  Matches,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'dateRangeValid', async: false })
class DateRangeConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments) {
    const obj = args.object as DashboardQueryDto;
    const start = new Date(obj.startDate);
    const end = new Date(obj.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;

    if (start > end) return false;

    const diffDays =
      Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diffDays <= 90;
  }

  defaultMessage(args: ValidationArguments) {
    const obj = args.object as DashboardQueryDto;
    const start = new Date(obj.startDate);
    const end = new Date(obj.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()))
      return 'startDate and endDate must be valid dates';

    if (start > end) return 'startDate must be on or before endDate';

    return 'Date range must not exceed 90 days';
  }
}

export class DashboardQueryDto {
  @IsNotEmpty({ message: 'startDate is required' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must be a valid YYYY-MM-DD date string',
  })
  startDate: string;

  @IsNotEmpty({ message: 'endDate is required' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate must be a valid YYYY-MM-DD date string',
  })
  @Validate(DateRangeConstraint)
  endDate: string;
}
