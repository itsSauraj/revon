import type { IconType } from 'react-icons';
import {
  LuArrowDownLeft,
  LuArrowDownRight,
  LuArrowUp,
  LuArrowUpLeft,
  LuArrowUpRight,
  LuCircleDot,
  LuCornerUpLeft,
  LuCornerUpRight,
  LuMerge,
  LuRedo2,
  LuRotateCcw,
  LuRotateCw,
  LuShip,
  LuSplit,
  LuUndo2,
  LuFlag,
} from 'react-icons/lu';

/** Routes API maneuver -> icon (Lucide). */
export const MANEUVER_ICON: Record<string, IconType> = {
  TURN_LEFT: LuCornerUpLeft,
  TURN_RIGHT: LuCornerUpRight,
  TURN_SLIGHT_LEFT: LuArrowUpLeft,
  TURN_SLIGHT_RIGHT: LuArrowUpRight,
  TURN_SHARP_LEFT: LuArrowDownLeft,
  TURN_SHARP_RIGHT: LuArrowDownRight,
  UTURN_LEFT: LuUndo2,
  UTURN_RIGHT: LuRedo2,
  STRAIGHT: LuArrowUp,
  RAMP_LEFT: LuArrowUpLeft,
  RAMP_RIGHT: LuArrowUpRight,
  MERGE: LuMerge,
  FORK_LEFT: LuSplit,
  FORK_RIGHT: LuSplit,
  ROUNDABOUT_LEFT: LuRotateCcw,
  ROUNDABOUT_RIGHT: LuRotateCw,
  DEPART: LuCircleDot,
  FERRY: LuShip,
  FERRY_TRAIN: LuShip,
};

export function maneuverIcon(maneuver: string | undefined): IconType {
  return (maneuver && MANEUVER_ICON[maneuver]) || LuArrowUp;
}

export const ARRIVE_ICON = LuFlag;
