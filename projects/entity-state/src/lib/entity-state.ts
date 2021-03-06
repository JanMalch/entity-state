import { Type } from '@angular/core';
import { StateContext } from '@ngxs/store';
import {
  EntityAddAction,
  EntityCreateOrReplaceAction,
  EntityRemoveAction,
  EntitySetActiveAction,
  EntitySetErrorAction,
  EntitySetLoadingAction,
  EntityUpdateAction,
  EntityUpdateActiveAction,
  GoToPageAction,
  SetPageSizeAction
} from './actions';
import {
  InvalidIdError,
  NoActiveEntityError,
  NoSuchEntityError,
  UpdateFailedError
} from './errors';
import { IdStrategy } from './id-strategy';
import { getActive, HashMap } from './internal';
import IdGenerator = IdStrategy.IdGenerator;

/**
 * Interface for an EntityState.
 * Includes the entities in an object literal, the loading and error state and the ID of the active selected entity.
 */
export interface EntityStateModel<T> {
  entities: HashMap<T>;
  loading: boolean;
  error: Error | undefined;
  active: string | undefined;
  ids: string[];
  pageSize: number;
  pageIndex: number;
  lastUpdated: Date;
}

/**
 * Returns a new object which serves as the default state.
 * No entities, loading is false, error is undefined, active is undefined.
 */
export function defaultEntityState<T>(
  defaults: Partial<EntityStateModel<T>> = {}
): EntityStateModel<T> {
  return {
    entities: {},
    ids: [],
    loading: false,
    error: undefined,
    active: undefined,
    pageSize: 5,
    pageIndex: 0,
    lastUpdated: new Date(),
    ...defaults
  };
}

export type DeepReadonly<T> = T extends (infer R)[]
  ? DeepReadonlyArray<R>
  : T extends Function
  ? T
  : T extends object
  ? DeepReadonlyObject<T>
  : T;

// This should be ReadonlyArray but it has implications.
export interface DeepReadonlyArray<T> extends Array<DeepReadonly<T>> {}

export type DeepReadonlyObject<T> = { readonly [P in keyof T]: DeepReadonly<T[P]> };

export type StateSelector<T> = (state: EntityStateModel<any>) => T;

// @dynamic
export abstract class EntityState<T extends {}> {
  private readonly idKey: string;
  private readonly storePath: string;
  protected readonly idGenerator: IdGenerator<T>;

  protected constructor(
    storeClass: Type<EntityState<T>>,
    _idKey: keyof T,
    idStrategy: Type<IdGenerator<T>>
  ) {
    this.idKey = _idKey as string;
    this.storePath = storeClass['NGXS_META'].path;
    this.idGenerator = new idStrategy(_idKey);

    this.setup(
      storeClass,
      'add',
      'createOrReplace',
      'update',
      'updateActive',
      'remove',
      'removeActive',
      'setLoading',
      'setError',
      'setActive',
      'clearActive',
      'reset',
      'goToPage',
      'setPageSize'
    );
  }

  private static get staticStorePath(): string {
    const that = this;
    return that['NGXS_META'].path;
  }

  /**
   * This function is called every time an entity is updated.
   * It receives the current entity and a partial entity that was either passed directly or generated with a function
   * @see Updater
   * @param current The current entity, readonly
   * @param updated The new data as a partial entity
   * @example
   *onUpdate(current: ToDo, updated: Partial<ToDo>): ToDo {
  return {...current, ...updated};
}
   */
  abstract onUpdate(current: DeepReadonly<T>, updated: DeepReadonly<Partial<T>>): T;

  // ------------------- SELECTORS -------------------

  /**
   * Returns a selector for the activeId
   */
  static get activeId(): StateSelector<string> {
    const that = this;
    return state => {
      const subState = elvis(state, that.staticStorePath) as EntityStateModel<any>;
      return subState.active;
    };
  }

  /**
   * Returns a selector for the active entity
   */
  static get active(): StateSelector<any> {
    const that = this;
    return state => {
      const subState = elvis(state, that.staticStorePath) as EntityStateModel<any>;
      return getActive(subState);
    };
  }

  /**
   * Returns a selector for the keys of all entities
   */
  static get keys(): StateSelector<string[]> {
    const that = this;
    return state => {
      const subState = elvis(state, that.staticStorePath) as EntityStateModel<any>;
      return Object.keys(subState.entities);
    };
  }

  /**
   * Returns a selector for all entities, sorted by insertion order
   */
  static get entities(): StateSelector<any[]> {
    const that = this;
    return state => {
      const subState = elvis(state, that.staticStorePath) as EntityStateModel<any>;
      return subState.ids.map(id => subState.entities[id]);
    };
  }

  /**
   * Returns a selector for the nth entity, sorted by insertion order
   */
  static nthEntity(index: number): StateSelector<any> {
    // tslint:disable-line:member-ordering
    const that = this;
    return state => {
      const subState = elvis(state, that.staticStorePath) as EntityStateModel<any>;
      const id = subState.ids[index];
      return subState.entities[id];
    };
  }

  /**
   * Returns a selector for paginated entities, sorted by insertion order
   */
  static get paginatedEntities(): StateSelector<any[]> {
    // tslint:disable-line:member-ordering
    const that = this;
    return state => {
      const subState = elvis(state, that.staticStorePath) as EntityStateModel<any>;
      const { ids, pageIndex, pageSize } = subState;
      return ids
        .slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)
        .map(id => subState.entities[id]);
    };
  }

  /**
   * Returns a selector for the map of entities
   */
  static get entitiesMap(): StateSelector<HashMap<any>> {
    const that = this;
    return state => {
      const subState = elvis(state, that.staticStorePath) as EntityStateModel<any>;
      return subState.entities;
    };
  }

  /**
   * Returns a selector for the size of the entity map
   */
  static get size(): StateSelector<number> {
    const that = this;
    return state => {
      const subState = elvis(state, that.staticStorePath) as EntityStateModel<any>;
      return Object.keys(subState.entities).length;
    };
  }

  /**
   * Returns a selector for the error
   */
  static get error(): StateSelector<Error | undefined> {
    const that = this;
    return state => {
      const name = that.staticStorePath;
      return elvis(state, name).error;
    };
  }

  /**
   * Returns a selector for the loading state
   */
  static get loading(): StateSelector<boolean> {
    const that = this;
    return state => {
      const name = that.staticStorePath;
      return elvis(state, name).loading;
    };
  }

  /**
   * Returns a selector for the latest added entity
   */
  static get latest(): StateSelector<any> {
    const that = this;
    return state => {
      const subState = elvis(state, that.staticStorePath) as EntityStateModel<any>;
      const latestId = subState.ids[subState.ids.length - 1];
      return subState.entities[latestId];
    };
  }

  /**
   * Returns a selector for the latest added entity id
   */
  static get latestId(): StateSelector<string | undefined> {
    const that = this;
    return state => {
      const subState = elvis(state, that.staticStorePath) as EntityStateModel<any>;
      return subState.ids[subState.ids.length - 1];
    };
  }

  /**
   * Returns a selector, indicating if the given ID is present
   */
  static idExists(id: string): StateSelector<boolean> {
    // tslint:disable-line:member-ordering
    const that = this;
    return state => {
      const subState = elvis(state, that.staticStorePath) as EntityStateModel<any>;
      return subState.ids.includes(id);
    };
  }

  /**
   * Returns a selector, indicating if an entity is active
   */
  static get hasActiveEntity(): StateSelector<boolean> {
    // tslint:disable-line:member-ordering
    const that = this;
    return state => {
      const subState = elvis(state, that.staticStorePath) as EntityStateModel<any>;
      return subState.active !== undefined;
    };
  }

  /**
   * Returns a selector, indicating if there any entities present
   */
  static get isEmpty(): StateSelector<boolean> {
    // tslint:disable-line:member-ordering
    const that = this;
    return state => {
      const subState = elvis(state, that.staticStorePath) as EntityStateModel<any>;
      return subState.ids.length === 0;
    };
  }

  /**
   * Returns a selector for the update timestamp
   */
  static get lastUpdated(): StateSelector<Date> {
    // tslint:disable-line:member-ordering
    const that = this;
    return state => {
      const subState = elvis(state, that.staticStorePath) as EntityStateModel<any>;
      return subState.lastUpdated;
    };
  }

  // ------------------- ACTION HANDLERS -------------------

  /**
   * The entities given by the payload will be added.
   * For certain ID strategies this might fail, if it provides an existing ID.
   * In all cases it will overwrite the ID value in the entity with the calculated ID.
   */
  add(
    { getState, patchState }: StateContext<EntityStateModel<T>>,
    { payload }: EntityAddAction<T>
  ) {
    const updated = this._addOrReplace(
      getState(),
      payload,
      // for automated ID strategies this mostly shouldn't throw an UnableToGenerateIdError error
      // for EntityIdGenerator it will throw an error if no ID is present
      (p, state) => this.idGenerator.generateId(p, state)
    );
    patchState({ ...updated, lastUpdated: new Date() });
  }

  /**
   * The entities given by the payload will be added.
   * It first checks if the ID provided by each entity does exist.
   * If it does the current entity will be replaced.
   * In all cases it will overwrite the ID value in the entity with the calculated ID.
   */
  createOrReplace(
    { getState, patchState }: StateContext<EntityStateModel<T>>,
    { payload }: EntityCreateOrReplaceAction<T>
  ) {
    const updated = this._addOrReplace(getState(), payload, (p, state) =>
      this.idGenerator.getPresentIdOrGenerate(p, state)
    );
    patchState({ ...updated, lastUpdated: new Date() });
  }

  update(
    { getState, patchState }: StateContext<EntityStateModel<T>>,
    { payload }: EntityUpdateAction<T>
  ) {
    let entities = { ...getState().entities }; // create copy

    let affected: T[];

    if (payload.id === null) {
      affected = Object.values(entities);
    } else if (typeof payload.id === 'function') {
      affected = Object.values(entities).filter(e => (<Function>payload.id)(e));
    } else {
      const ids = asArray(payload.id);
      affected = Object.values(entities).filter(e => ids.includes(this.idOf(e)));
    }

    if (typeof payload.data === 'function') {
      affected.forEach(e => {
        entities = this._update(entities, (<Function>payload.data)(e), this.idOf(e));
      });
    } else {
      affected.forEach(e => {
        entities = this._update(entities, payload.data as Partial<T>, this.idOf(e));
      });
    }

    patchState({ entities, lastUpdated: new Date() });
  }

  updateActive(
    { getState, patchState }: StateContext<EntityStateModel<T>>,
    { payload }: EntityUpdateActiveAction<T>
  ) {
    const state = getState();
    const { id, active } = mustGetActive(state);
    const { entities } = state;

    if (typeof payload === 'function') {
      patchState({
        entities: { ...this._update(entities, payload(active), id) },
        lastUpdated: new Date()
      });
    } else {
      patchState({
        entities: { ...this._update(entities, payload, id) },
        lastUpdated: new Date()
      });
    }
  }

  removeActive({ getState, patchState }: StateContext<EntityStateModel<T>>) {
    const { entities, ids, active } = getState();
    delete entities[active];
    patchState({
      entities: { ...entities },
      ids: ids.filter(id => id !== active),
      active: undefined,
      lastUpdated: new Date()
    });
  }

  remove(
    { getState, patchState }: StateContext<EntityStateModel<T>>,
    { payload }: EntityRemoveAction<T>
  ) {
    const { entities, ids, active } = getState();

    if (payload === null) {
      patchState({
        entities: {},
        ids: [],
        active: undefined,
        lastUpdated: new Date()
      });
    } else {
      const deleteIds: string[] =
        typeof payload === 'function'
          ? Object.values(entities)
              .filter(e => payload(e))
              .map(e => this.idOf(e))
          : asArray(payload);

      const wasActive = deleteIds.includes(active);
      deleteIds.forEach(id => delete entities[id]);
      patchState({
        entities: { ...entities },
        ids: ids.filter(id => !deleteIds.includes(id)),
        active: wasActive ? undefined : active,
        lastUpdated: new Date()
      });
    }
  }

  reset({ setState }: StateContext<EntityStateModel<T>>) {
    setState(defaultEntityState());
  }

  setLoading(
    { patchState }: StateContext<EntityStateModel<T>>,
    { payload }: EntitySetLoadingAction
  ) {
    patchState({ loading: payload });
  }

  setActive(
    { getState, patchState }: StateContext<EntityStateModel<T>>,
    { payload }: EntitySetActiveAction
  ) {
    if ('id' in payload) {
      patchState({ active: payload.id });
    } else {
      const step = payload['prev'] ? -1 : 1;
      const { active, ids } = getState();
      let index = ids.findIndex(id => id === active) + step;
      const maxIndex = ids.length - 1;
      index = wrapOrClamp(payload.wrap, index, 0, maxIndex);
      patchState({ active: ids[index] });
    }
  }

  clearActive({ patchState }: StateContext<EntityStateModel<T>>) {
    patchState({ active: undefined });
  }

  setError(
    { patchState }: StateContext<EntityStateModel<T>>,
    { payload }: EntitySetErrorAction
  ) {
    patchState({ error: payload });
  }

  goToPage(
    { getState, patchState }: StateContext<EntityStateModel<T>>,
    { payload }: GoToPageAction
  ) {
    if ('page' in payload) {
      patchState({ pageIndex: payload.page });
      return;
    } else if (payload['first']) {
      patchState({ pageIndex: 0 });
      return;
    }

    const { entities, pageSize, pageIndex } = getState();
    const totalSize = Object.keys(entities).length;
    const maxIndex = Math.floor(totalSize / pageSize);

    if ('last' in payload) {
      patchState({ pageIndex: maxIndex });
    } else {
      const step = payload['prev'] ? -1 : 1;
      let index = pageIndex + step;
      index = wrapOrClamp(payload.wrap, index, 0, maxIndex);
      patchState({ pageIndex: index });
    }
  }

  setPageSize(
    { getState, patchState }: StateContext<EntityStateModel<T>>,
    { payload }: SetPageSizeAction
  ) {
    patchState({ pageSize: payload });
  }

  // ------------------- UTILITY -------------------

  /**
   * A utility function to update the given state with the given entities.
   * It returns a state model with the new entities map and IDs.
   * For each given entity an ID will be generated. The generated ID will overwrite the current value:
   * <code>entity[this.idKey] = generatedId(entity, state);</code>
   * If the ID wasn't present, it will be added to the state's IDs array.
   * @param state The current state to act on
   * @param payload One or multiple partial entities
   * @param generateId A function to generate an ID for each given entity
   */
  private _addOrReplace(
    state: EntityStateModel<T>,
    payload: T | T[],
    generateId: (payload: Partial<T>, state: EntityStateModel<T>) => string
  ): { entities: HashMap<T>; ids: string[] } {
    const { entities, ids } = state;
    asArray(payload).forEach(entity => {
      const id = generateId(entity, state);
      entity[this.idKey] = id;
      entities[id] = entity;
      if (!ids.includes(id)) {
        ids.push(id);
      }
    });

    return {
      entities: { ...entities },
      ids: [...ids]
    };
  }

  /**
   * A utility function to update the given entities map with the provided partial entity.
   * After checking if an entity with the given ID is present, the #onUpdate method is called.
   * @param entities The current entity map
   * @param entity The partial entity to update with
   * @param id The ID to find the current entity in the map
   */
  private _update(
    entities: HashMap<T>,
    entity: Partial<T>,
    id: string = this.idOf(entity)
  ): HashMap<T> {
    if (id === undefined) {
      throw new UpdateFailedError(new InvalidIdError(id));
    }
    const current = entities[id];
    if (current === undefined) {
      throw new UpdateFailedError(new NoSuchEntityError(id));
    }
    entities[id] = this.onUpdate(current as any, entity as any);
    return entities;
  }

  private setup(storeClass: Type<EntityState<T>>, ...actions: string[]) {
    actions.forEach(fn => {
      const actionName = `[${this.storePath}] ${fn}`;
      storeClass['NGXS_META'].actions[actionName] = [
        {
          fn: fn,
          options: {},
          type: actionName
        }
      ];
    });
  }

  protected idOf(data: Partial<T>): string {
    // TODO: assertValidId here every time?
    return data[this.idKey];
  }
}

/**
 * Returns the active entity. If none is present an error will be thrown.
 * @param state The state to act on
 */
function mustGetActive<T>(state: EntityStateModel<T>): { id: string; active: T } {
  const active = getActive(state);
  if (active === undefined) {
    throw new NoActiveEntityError();
  }
  return { id: state.active, active };
}

/**
 * Undefined-safe function to access the property given by path parameter
 * @param object The object to read from
 * @param path The path to the property
 */
function elvis(object: any, path: string): any | undefined {
  return path ? path.split('.').reduce((value, key) => value && value[key], object) : object;
}

/**
 * Returns input as an array if it isn't one already
 * @param input The input to make an array if necessary
 */
function asArray<T>(input: T | T[]): T[] {
  return Array.isArray(input) ? input : [input];
}

/**
 * Limits a number to the given boundaries
 * @param value The input value
 * @param min The minimum value
 * @param max The maximum value
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Uses the clamp function is wrap is false.
 * Else it wrap to the max or min value respectively.
 * @param wrap Flag to indicate if value should be wrapped
 * @param value The input value
 * @param min The minimum value
 * @param max The maximum value
 */
function wrapOrClamp(wrap: boolean, value: number, min: number, max: number): number {
  if (!wrap) {
    return clamp(value, min, max);
  } else if (value < min) {
    return max;
  } else if (value > max) {
    return min;
  } else {
    return value;
  }
}
