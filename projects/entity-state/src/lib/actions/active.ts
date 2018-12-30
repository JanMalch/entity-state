import { generateActionObject } from '../internal';
import { Payload, Updater } from './type-alias';
import { EntityState } from '../entity-state';
import { Type } from '@angular/core';

export type EntitySetActivePayload =
  | { id: string }
  | { prev: true; wrap?: boolean }
  | { next: true; wrap?: boolean };
export type EntitySetActiveAction = Payload<EntitySetActivePayload & { wrap: boolean }>;
export type EntityUpdateActiveAction<T> = Payload<Updater<T>>;

export class SetActive {
  /**
   * Generates an action that sets an ID that identifies the active entity
   * @param target The targeted state class
   * @param payload The payload that identifies the active entity
   * @see EntitySetActivePayload
   */
  constructor(target: Type<EntityState<any>>, payload: EntitySetActivePayload) {
    return generateActionObject('setActive', target, { wrap: false, ...payload });
  }
}

export class ClearActive {
  /**
   * Generates an action that clears the active entity in the given state
   * @param target The targeted state class
   */
  constructor(target: Type<EntityState<any>>) {
    return generateActionObject('clearActive', target);
  }
}

export class RemoveActive {
  /**
   * Generates an action that removes the active entity from the state and clears the active ID.
   * @param target The targeted state class
   */
  constructor(target: Type<EntityState<any>>) {
    return generateActionObject('removeActive', target);
  }
}

// TODO: Confirm behaviour
export class UpdateActive<T> {
  /**
   * Generates an action that will update the current active entity.
   * If no entity is active a runtime error will be thrown.
   * @param target The targeted state class
   * @param payload An Updater payload
   * @see Updater
   */
  constructor(target: Type<EntityState<T>>, payload: Updater<T>) {
    return generateActionObject('updateActive', target, payload);
  }
}
