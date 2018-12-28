import { State } from '@ngxs/store';
import {
  DeepReadonly,
  defaultEntityState,
  EntityState,
  EntityStateModel,
  IdStrategy
} from 'entity-state';

export interface ToDo {
  title: string;
  description: string;
  done: boolean;
}

@State<EntityStateModel<ToDo>>({
  name: 'todo',
  defaults: defaultEntityState()
})
export class TodoState extends EntityState<ToDo> {
  constructor() {
    super(TodoState, 'title', IdStrategy.EntityIdGenerator);
  }

  onUpdate(current: DeepReadonly<ToDo>, updated: DeepReadonly<Partial<ToDo>>): ToDo {
    return { ...current, ...updated };
  }
}
