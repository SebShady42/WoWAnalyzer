import React from 'react';

import SpellIcon from 'common/SpellIcon';
import SpellLink from 'common/SpellLink';
import SPELLS from 'common/SPELLS';
import { TooltipElement } from 'common/Tooltip';
import SPECS from 'game/SPECS';
import SpecIcon from 'common/SpecIcon';
import { formatDuration } from 'common/format';

import Events from 'parser/core/Events';
import Analyzer, { SELECTED_PLAYER } from 'parser/core/Analyzer';

import AbilityTracker from 'parser/shared/modules/AbilityTracker';
import Combatants from 'parser/shared/modules/Combatants';
import StatisticBox, { STATISTIC_ORDER } from 'interface/others/StatisticBox';

const CHAIN_HEAL_TARGET_EFFICIENCY = 0.97;
const HEAL_WINDOW_MS = 250;

class ChainHeal extends Analyzer {
  static dependencies = {
    abilityTracker: AbilityTracker,
    combatants: Combatants,
  };

  buffer = [];
  chainHeals = [];
  cast = 0;
  chainHealTimestamp = 0;

  constructor(...args) {
    super(...args);
    this.maxTargets = 4;
    this.suggestedTargets = this.maxTargets * CHAIN_HEAL_TARGET_EFFICIENCY;

    this.addEventListener(Events.heal.by(SELECTED_PLAYER).spell(SPELLS.CHAIN_HEAL), this.chainHeal);
    this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(SPELLS.CHAIN_HEAL), this.chainHeal);
  }

  chainHeal(event) {
    if (!this.chainHealTimestamp || event.timestamp - this.chainHealTimestamp > HEAL_WINDOW_MS) {
      this.processBuffer();
      this.chainHealTimestamp = event.timestamp;
    }

    this.buffer.push({
      ...event,
    });
  }

  processBuffer() {
    if (this.buffer.length === 0) {
      return;
    }
    this.cast++;
    this.chainHeals[this.cast] = {};
    const cast = this.buffer.find(event => event.type === "cast");
    if (!cast) {
      return;
    }
    const combatant = this.combatants.getEntity(cast);
    if (!combatant) {
      return;
    }
    this.chainHeals[this.cast].target = {
      id: cast.targetID,
      name: combatant.name,
      spec: SPECS[combatant.specId],
      specClassName: SPECS[combatant.specId].className.replace(' ', ''),
    };

    this.chainHeals[this.cast].timestamp = cast.timestamp;
    this.chainHeals[this.cast].castNo = this.cast;
    this.chainHeals[this.cast].hits = this.buffer.filter(event => event.type === "heal").length;
    this.buffer = [];
  }

  suggestions(when) {
    const suggestedThreshold = this.suggestionThreshold;
    if (isNaN(suggestedThreshold.actual)) {
      return;
    }
    when(suggestedThreshold.actual).isLessThan(suggestedThreshold.isLessThan.minor)
      .addSuggestion((suggest, actual, recommended) => {
        return suggest(<span>Try to always cast <SpellLink id={SPELLS.CHAIN_HEAL.id} /> on groups of people, so that it heals all {this.maxTargets} potential targets.</span>)
          .icon(SPELLS.CHAIN_HEAL.icon)
          .actual(`${suggestedThreshold.actual.toFixed(2)} average targets healed`)
          .recommended(`${suggestedThreshold.isLessThan.minor} average targets healed`)
          .regular(suggestedThreshold.isLessThan.average).major(suggestedThreshold.isLessThan.major);
      });
  }

  get avgHits() {
    const chainHeal = this.abilityTracker.getAbility(SPELLS.CHAIN_HEAL.id);
    const casts = chainHeal.casts || 0;
    const hits = chainHeal.healingHits || 0;
    return hits / casts || 0;
  }

  get casts() {
    return this.abilityTracker.getAbility(SPELLS.CHAIN_HEAL.id).casts || 0;
  }

  get suggestionThreshold() {
    return {
      actual: this.avgHits,
      isLessThan: {
        minor: this.suggestedTargets,//Missed 1 target
        average: this.suggestedTargets - 1,//Missed 2-3 targets
        major: this.suggestedTargets - 2,//Missed more than 3 targets
      },
      style: 'number',
    };
  }

  statistic() {
    if (this.casts === 0) {
      return false;
    }

    const singleHits = this.chainHeals.filter(cast => cast.hits === 1);
    const formatNth = (number) => ["st", "nd", "rd"][((number + 90) % 100 - 10) % 10 - 1] || "th";
    return (
      <StatisticBox
        icon={<SpellIcon id={SPELLS.CHAIN_HEAL.id} />}
        value={this.avgHits.toFixed(2)}
        position={STATISTIC_ORDER.OPTIONAL(70)}
        label={(
          <TooltipElement content={`The average number of targets healed by Chain Heal out of the maximum amount of targets. You cast a total of ${this.casts} Chain Heals, which healed an average of ${this.avgHits.toFixed(2)} out of ${this.maxTargets} targets.`}>
            Average Chain Heal targets
          </TooltipElement>
        )}
      >
        {singleHits.length > 0 && (
          <>
            <div>
              Below are the casts that only hit the initial target. A large list indicates that target selection is an area for improvement.
            </div>
            <table className="table table-condensed" style={{ fontWeight: 'bold' }}>
              <thead>
                <tr>
                  <th>Cast</th>
                  <th>Time</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {
                  this.chainHeals
                    .filter(cast => cast.hits === 1)
                    .map(cast => (
                      <tr key={cast.timestamp}>
                        <th scope="row">{cast.castNo}{formatNth(cast.castNo)}</th>
                        <td>{formatDuration((cast.timestamp - this.owner.fight.start_time) / 1000, 0)}</td>
                        <td className={cast.target.specClassName}> <SpecIcon id={cast.target.spec.id} />{' '}{cast.target.name}</td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </>
        )}
      </StatisticBox>
    );
  }
}

export default ChainHeal;
