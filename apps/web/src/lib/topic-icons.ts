import {
  Coins,
  Compass,
  Cpu,
  Dna,
  FlaskConical,
  GraduationCap,
  HeartPulse,
  Infinity as InfinityIcon,
  Landmark,
  Leaf,
  Rocket,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * An icon per top-level topic, for scanning lists of domains. Presentation only: topics are data (an admin can
 * add one), so anything unknown gets a neutral compass.
 */
const ICONS: Record<string, LucideIcon> = {
  technology: Cpu,
  science: FlaskConical,
  biology: Dna,
  medicine: HeartPulse,
  environment: Leaf,
  energy: Zap,
  space: Rocket,
  governance: Landmark,
  society: Users,
  economics: Coins,
  education: GraduationCap,
  humanity: InfinityIcon,
};

export const topicIcon = (slug: string): LucideIcon => ICONS[slug] ?? Compass;
