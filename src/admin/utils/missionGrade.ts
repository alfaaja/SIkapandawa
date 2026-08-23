import { getMissionReportRank } from '../../shared/game/reporting';

export function deriveMissionGrade(totalStars: number): string {
    if (!Number.isInteger(totalStars) || totalStars < 0 || totalStars > 30) {
        throw new RangeError('Total stars must be an integer between 0 and 30');
    }
    return getMissionReportRank(totalStars).name;
}
