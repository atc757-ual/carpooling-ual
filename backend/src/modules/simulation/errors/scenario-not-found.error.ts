import { BusinessError } from '../../../shared/errors/business-error';

// No existe ningún escenario con ese código. La capa API lo traduce a un 404
// (SCENARIO_NOT_FOUND)
export class ScenarioNotFoundError extends BusinessError {
  constructor(readonly scenarioCode: string) {
    super(
      'SCENARIO_NOT_FOUND',
      'not_found',
      'There is no scenario with code ' + scenarioCode,
    );
  }
}
