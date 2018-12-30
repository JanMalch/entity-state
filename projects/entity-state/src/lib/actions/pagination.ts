import { Payload } from './type-alias';
import { Type } from '@angular/core';
import { EntityState } from '../entity-state';
import { generateActionObject } from '../internal';

export type GoToPagePayload =
  | { page: number }
  | { next: true; wrap?: boolean }
  | { prev: true; wrap?: boolean }
  | { last: true }
  | { first: true };
export type GoToPageAction = Payload<GoToPagePayload & { wrap: boolean }>;

export class GoToPage {
  /**
   */
  constructor(target: Type<EntityState<any>>, payload: GoToPagePayload) {
    return generateActionObject('goToPage', target, { wrap: false, ...payload });
  }
}

export type SetPageSizeAction = Payload<number>;

export class SetPageSize {
  /**
   */
  constructor(target: Type<EntityState<any>>, payload: number) {
    return generateActionObject('goToPage', target, payload);
  }
}
