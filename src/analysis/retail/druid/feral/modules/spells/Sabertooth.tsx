import Analyzer, { SELECTED_PLAYER } from 'parser/core/Analyzer';
import { Options } from 'parser/core/Module';
import { TALENTS_DRUID } from 'common/TALENTS';
import SPELLS from 'common/SPELLS';
import Events, { DamageEvent } from 'parser/core/Events';
import { calculateEffectiveDamage } from 'parser/core/EventCalculateLib';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_ORDER from 'parser/ui/STATISTIC_ORDER';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import ItemPercentDamageDone from 'parser/ui/ItemPercentDamageDone';
import { SpellLink } from 'interface';
import { formatPercentage } from 'common/format';
import { getBiteCps } from 'analysis/retail/druid/feral/constants';

const FEROCIOUS_BITE_BOOST = 0.15;
const RIP_BOOST_PER_CP = 0.05;

/**
 * **Sabertooth**
 * Spec Talent
 *
 * Ferocious Bite deals 15% increased damage and increases all damage dealt by Rip by 5% per
 * Combo Point spent for 4 sec.
 */
class Sabertooth extends Analyzer {
  /** Damage due to the increase to Ferocious Bite */
  fbBoostDamage = 0;
  /** Damage due to the buff increase to Rip */
  ripBoostDamage = 0;
  /** Damage due to the buff increase to Tear Open Wounds (implicit with Rip boost) */
  towBoostDamage = 0;

  /** Total ticks of Rip */
  totalRipTicks = 0;
  /** Ticks of Rip that were boosted by Sabertooth */
  boostedRipTicks = 0;

  /** Current boost from Sabertooth due to last FB */
  currentSbtStrength = 0;

  constructor(options: Options) {
    super(options);

    this.active = this.selectedCombatant.hasTalent(TALENTS_DRUID.SABERTOOTH_TALENT);
    this.addEventListener(
      Events.damage.by(SELECTED_PLAYER).spell(SPELLS.FEROCIOUS_BITE),
      this.onFbDamage,
    );
    this.addEventListener(
      Events.damage.by(SELECTED_PLAYER).spell(SPELLS.TEAR_OPEN_WOUNDS),
      this.onTowDamage,
    );
    this.addEventListener(Events.damage.by(SELECTED_PLAYER).spell(SPELLS.RIP), this.onRipDamage);
  }

  onFbDamage(event: DamageEvent) {
    this.fbBoostDamage += calculateEffectiveDamage(event, FEROCIOUS_BITE_BOOST);
    this.currentSbtStrength = getBiteCps(event) * RIP_BOOST_PER_CP;
  }

  onTowDamage(event: DamageEvent) {
    if (this.selectedCombatant.hasBuff(SPELLS.SABERTOOTH.id)) {
      this.towBoostDamage += calculateEffectiveDamage(event, this.currentSbtStrength);
    }
  }

  onRipDamage(event: DamageEvent) {
    this.totalRipTicks += 1;
    if (this.selectedCombatant.hasBuff(SPELLS.SABERTOOTH.id)) {
      this.boostedRipTicks += 1;
      this.ripBoostDamage += calculateEffectiveDamage(event, this.currentSbtStrength);
    }
  }

  get totalDamage() {
    return this.fbBoostDamage + this.ripBoostDamage + this.towBoostDamage;
  }

  get percentBoostedRipTicks() {
    return this.totalRipTicks === 0 ? 0 : this.boostedRipTicks / this.totalRipTicks;
  }

  statistic() {
    return (
      <Statistic
        position={STATISTIC_ORDER.OPTIONAL(3)} // number based on talent row
        size="flexible"
        category={STATISTIC_CATEGORY.TALENTS}
        tooltip={
          <>
            Percent boosted <SpellLink spell={SPELLS.RIP} /> ticks:{' '}
            <strong>{formatPercentage(this.percentBoostedRipTicks, 1)}%</strong>
            <br />
            Breakdown by source:
            <ul>
              <li>
                <SpellLink spell={SPELLS.FEROCIOUS_BITE} />:{' '}
                <strong>{this.owner.formatItemDamageDone(this.fbBoostDamage)}</strong>
              </li>
              <li>
                <SpellLink spell={SPELLS.RIP} />:{' '}
                <strong>{this.owner.formatItemDamageDone(this.ripBoostDamage)}</strong>
              </li>
              {this.selectedCombatant.hasTalent(TALENTS_DRUID.TEAR_OPEN_WOUNDS_TALENT) && (
                <li>
                  <SpellLink spell={SPELLS.TEAR_OPEN_WOUNDS} />:{' '}
                  <strong>{this.owner.formatItemDamageDone(this.towBoostDamage)}</strong>
                </li>
              )}
            </ul>
          </>
        }
      >
        <BoringSpellValueText spell={TALENTS_DRUID.SABERTOOTH_TALENT}>
          <ItemPercentDamageDone amount={this.totalDamage} />
        </BoringSpellValueText>
      </Statistic>
    );
  }
}

export default Sabertooth;
