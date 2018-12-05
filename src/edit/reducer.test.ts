import { edit as subject, EditState } from './reducer';
import { FormState } from './FormState';
import * as actions from './actions';
import * as noteActions from '../notes/actions';
import { Card } from '../model';
import { CardChange } from '../store/CardStore';
import { StoreError } from '../store/DataStore';
import { generateCard } from '../utils/testing';

const emptyState = (
  newFormId: number,
  initialTags?: Array<string> | undefined
): EditState => ({
  forms: {
    active: {
      formId: newFormId,
      formState: FormState.Ok,
      isNew: true,
      card: { tags: initialTags },
      notes: [],
    },
  },
});

const okState = (
  formId: number,
  card: Partial<Card>,
  dirtyFields?: Set<keyof Card>
): EditState => {
  const result: EditState = {
    forms: {
      active: {
        formId,
        formState: FormState.Ok,
        isNew: false,
        card,
        notes: [],
      },
    },
  };

  if (dirtyFields) {
    result.forms.active.dirtyFields = dirtyFields;
  }

  return result;
};

const loadingState = (newFormId: number): EditState => ({
  forms: {
    active: {
      formId: newFormId,
      formState: FormState.Loading,
      isNew: false,
      card: {},
      notes: [],
    },
  },
});

const dirtyState = (
  formId: number,
  card: Partial<Card>,
  dirtyFields: Set<keyof Card>,
  isNew: boolean = false
): EditState => ({
  forms: {
    active: {
      formId,
      formState: FormState.Ok,
      isNew,
      card,
      dirtyFields,
      notes: [],
    },
  },
});

const notFoundState = (formId: number): EditState => ({
  forms: {
    active: {
      formId,
      formState: FormState.NotFound,
      isNew: false,
      card: {},
      notes: [],
    },
  },
});

const deletedState = (formId: number): EditState => ({
  forms: {
    active: {
      formId,
      formState: FormState.Deleted,
      isNew: false,
      card: {},
      notes: [],
    },
  },
});

const withSaveError = (state: EditState, saveError: StoreError): EditState => ({
  forms: {
    active: {
      ...state.forms.active,
      saveError,
    },
  },
});

const toDirtyFields = (...fields: Array<keyof Card>): Set<keyof Card> =>
  new Set(fields);

describe('reducer:edit', () => {
  it('should return the initial state', () => {
    const updatedState = subject(undefined, {} as any);

    expect(updatedState).toEqual(emptyState(0));
  });

  it('should update formId on NEW_CARD', () => {
    const updatedState = subject(undefined, actions.newCard(1));

    expect(updatedState).toEqual(emptyState(1));
  });

  it('should clear fields on NEW_CARD', () => {
    const initialState = okState(
      1,
      generateCard('abc'),
      toDirtyFields('question', 'answer')
    );

    const updatedState = subject(initialState, actions.newCard(2));

    expect(updatedState).toEqual(emptyState(2));
  });

  it('should persist the tags on NEW_CARD if the previous card was also new', () => {
    const initialState = emptyState(4, ['Tag 1', 'Tag 2']);

    const updatedState = subject(initialState, actions.newCard(5));

    expect(updatedState.forms.active.card.tags).toEqual(['Tag 1', 'Tag 2']);
  });

  it('should NOT persist the tags on NEW_CARD if the previous card was not new', () => {
    const initialState = okState(
      4,
      { ...generateCard('abc'), tags: ['Tag 1', 'Tag 2'] },
      toDirtyFields('question', 'answer')
    );

    const updatedState = subject(initialState, actions.newCard(5));

    expect(updatedState.forms.active.card.tags).toBeUndefined();
  });

  it('should update formId and state on LOAD_CARD', () => {
    const updatedState = subject(undefined, actions.loadCard('abc', 2));

    expect(updatedState).toEqual(loadingState(2));
  });

  it('should clear other state on LOAD_CARD', () => {
    const initialState = okState(
      2,
      generateCard('abc'),
      toDirtyFields('question', 'answer')
    );

    const updatedState = subject(initialState, actions.loadCard('def', 3));

    expect(updatedState).toEqual(loadingState(3));
  });

  it('should update card info and state on FINISH_LOAD_CARD', () => {
    const initialState = loadingState(5);
    const card = generateCard('abc');

    const updatedState = subject(initialState, actions.finishLoadCard(5, card));

    expect(updatedState).toEqual(okState(5, card));
  });

  it(
    'should NOT update card info and state on FINISH_LOAD_CARD if formIds' +
      ' differ',
    () => {
      const initialState = loadingState(7);
      const card = generateCard('def');

      const updatedState = subject(
        initialState,
        actions.finishLoadCard(8, card)
      );

      expect(updatedState).toEqual(initialState);
    }
  );

  it('should update state on FAIL_LOAD_CARD', () => {
    const initialState = loadingState(7);

    const updatedState = subject(
      initialState,
      actions.failLoadCard(7, { name: 'Error', message: 'Error' })
    );

    expect(updatedState).toEqual(notFoundState(7));
  });

  it('should NOT update state on FAIL_LOAD_CARD if formIds differ', () => {
    const initialState = loadingState(8);

    const updatedState = subject(
      initialState,
      actions.failLoadCard(9, { name: 'Error', message: 'Error' })
    );

    expect(updatedState).toEqual(initialState);
  });

  it('should update to deleted state on FAIL_LOAD_CARD (deleted)', () => {
    const initialState = loadingState(8);
    const error = { name: 'Error', message: 'Error', reason: 'deleted' };

    const updatedState = subject(initialState, actions.failLoadCard(8, error));

    expect(updatedState).toEqual(deletedState(8));
  });

  it('should update card and dirty fields and state on EDIT_CARD', () => {
    const initialState = okState(4, {
      _id: 'abc',
      question: 'Question',
      answer: 'Answer',
    });
    const change = {
      _id: 'abc',
      question: 'Updated question',
      answer: 'Answer',
    };

    const updatedState = subject(initialState, actions.editCard(4, change));

    expect(updatedState).toEqual(
      dirtyState(
        4,
        { _id: 'abc', question: 'Updated question', answer: 'Answer' },
        toDirtyFields('question')
      )
    );
  });

  it(
    'should update card and dirty fields and state on EDIT_CARD for new' +
      ' card',
    () => {
      const initialState = emptyState(7);
      const change = {
        question: 'Updated question',
        answer: 'Updated answer',
      };

      const updatedState = subject(initialState, actions.editCard(7, change));

      expect(updatedState).toEqual(
        dirtyState(
          7,
          { question: 'Updated question', answer: 'Updated answer' },
          toDirtyFields('question', 'answer'),
          true
        )
      );
    }
  );

  it(
    'should NOT update card and dirty fields and state on EDIT_CARD when' +
      ' formIds differ',
    () => {
      const initialState = okState(4, {
        _id: 'abc',
        question: 'Question',
        answer: 'Answer',
      });

      const change = {
        _id: 'def',
        question: 'Updated question',
        answer: 'Answer',
      };
      const updatedState = subject(initialState, actions.editCard(5, change));

      expect(updatedState).toEqual(initialState);
    }
  );

  it('should append set of dirty fields on subsequent on EDIT_CARD', () => {
    const initialState = dirtyState(
      6,
      { _id: 'abc', question: 'Updated question', answer: 'Answer' },
      toDirtyFields('question')
    );
    const change = { answer: 'Updated answer' };

    const updatedState = subject(initialState, actions.editCard(6, change));

    expect(updatedState).toEqual(
      dirtyState(
        6,
        { _id: 'abc', question: 'Updated question', answer: 'Updated answer' },
        toDirtyFields('question', 'answer')
      )
    );
  });

  it('should clear the saveError on SAVE_CARD', () => {
    const withoutErrorState = dirtyState(
      11,
      { _id: 'abc', question: 'Updated question', answer: 'Answer' },
      toDirtyFields('question')
    );
    const initialState = withSaveError(withoutErrorState, {
      name: 'bad',
      message: 'Bad bad bad',
    });

    const updatedState = subject(initialState, actions.saveCard(11));

    expect(updatedState).toEqual(withoutErrorState);
  });

  it('should update state on FINISH_SAVE_CARD', () => {
    const initialState = dirtyState(
      11,
      { _id: 'abc', question: 'Updated question', answer: 'Answer' },
      toDirtyFields('question')
    );
    const card = {
      _id: 'abc',
      question: 'Updated question',
      answer: 'Answer',
    };

    const updatedState = subject(
      initialState,
      actions.finishSaveCard(11, card)
    );

    expect(updatedState).toEqual(
      okState(11, {
        _id: 'abc',
        question: 'Updated question',
        answer: 'Answer',
      })
    );
  });

  it(
    'should only update dirty-ness with regards to fields that have not' +
      ' since changed on FINISH_SAVE_CARD',
    () => {
      const initialState = dirtyState(
        12,
        { _id: 'abc', question: 'Updated #2', answer: 'Updated answer' },
        toDirtyFields('question', 'answer')
      );
      const card = {
        _id: 'abc',
        question: 'Updated #1',
        answer: 'Updated answer',
      };

      const updatedState = subject(
        initialState,
        actions.finishSaveCard(12, card)
      );

      expect(updatedState).toEqual(
        dirtyState(
          12,
          { _id: 'abc', question: 'Updated #2', answer: 'Updated answer' },
          toDirtyFields('question')
        )
      );
    }
  );

  it('should NOT update state on FINISH_SAVE_CARD if formIds differ', () => {
    const initialState = dirtyState(
      12,
      { _id: 'abc', question: 'Updated question', answer: 'Answer' },
      toDirtyFields('question')
    );
    const card = {
      _id: 'def',
      question: 'Updated question',
      answer: 'Answer',
    };

    const updatedState = subject(
      initialState,
      actions.finishSaveCard(13, card)
    );

    expect(updatedState).toEqual(initialState);
  });

  it('should update state on FINISH_SAVE_CARD with new card', () => {
    const initialState = dirtyState(
      12,
      { question: 'Question', answer: 'Answer' },
      toDirtyFields('question', 'answer')
    );
    const card = {
      _id: 'abc',
      question: 'Question',
      answer: 'Answer',
    };

    const updatedState = subject(
      initialState,
      actions.finishSaveCard(12, card)
    );

    expect(updatedState).toEqual(
      okState(12, { _id: 'abc', question: 'Question', answer: 'Answer' })
    );
  });

  it(
    'should only update dirty-ness with regards to fields that have not' +
      ' since changed on FINISH_SAVE_CARD with new card',
    () => {
      const initialState = dirtyState(
        17,
        { question: 'Updated #1', answer: 'Updated #2' },
        toDirtyFields('question', 'answer')
      );
      const card = {
        _id: 'abc',
        question: 'Updated #1',
        answer: 'Updated #1',
      };

      const updatedState = subject(
        initialState,
        actions.finishSaveCard(17, card)
      );

      expect(updatedState).toEqual(
        dirtyState(
          17,
          { _id: 'abc', question: 'Updated #1', answer: 'Updated #2' },
          toDirtyFields('answer')
        )
      );
    }
  );

  it(
    'should NOT update state on FINISH_SAVE_CARD with new card if formIds' +
      ' differ',
    () => {
      const initialState = dirtyState(
        12,
        { _id: 'abc', question: 'Question', answer: 'Answer' },
        toDirtyFields('question')
      );
      const card = {
        _id: 'def',
        question: 'Question',
        answer: 'Answer',
      };

      const updatedState = subject(
        initialState,
        actions.finishSaveCard(11, card)
      );

      expect(updatedState).toEqual(initialState);
    }
  );

  it('should NOT update state on FINISH_SAVE_CARD if the card is deleted', () => {
    // (This can happen if we have a stray auto-save task. In that case the
    // watchCardEdits saga needs to see that the card is deleted so that it goes
    // ahead and deletes the newly-saved card.)
    const initialState = deletedState(15);
    const card = {
      _id: 'abc',
      question: 'Question',
      answer: 'Answer',
    };

    const updatedState = subject(
      initialState,
      actions.finishSaveCard(15, card)
    );

    expect(updatedState).toEqual(initialState);
  });

  it('should update save error message on FAIL_SAVE_CARD', () => {
    const initialState = dirtyState(
      15,
      { _id: 'abc', question: 'Question', answer: 'Answer' },
      toDirtyFields('question')
    );

    const updatedState = subject(
      initialState,
      actions.failSaveCard(15, { name: 'bad', message: 'Bad bad bad' })
    );

    expect(updatedState).toEqual(
      withSaveError(initialState, { name: 'bad', message: 'Bad bad bad' })
    );
  });

  it(
    'should NOT update save error message on FAIL_SAVE_CARD if formIds' +
      ' differ',
    () => {
      const initialState = dirtyState(
        16,
        { _id: 'abc', question: 'Question', answer: 'Answer' },
        toDirtyFields('question')
      );

      const updatedState = subject(
        initialState,
        actions.failSaveCard(15, { name: 'bad', message: 'Bad bad bad' })
      );

      expect(updatedState).toEqual(initialState);
    }
  );

  it('should NOT update state on FAIL_SAVE_CARD if the card is deleted', () => {
    const initialState = deletedState(15);

    const updatedState = subject(
      initialState,
      actions.failSaveCard(15, { name: 'uhoh', message: 'Uh oh' })
    );

    expect(updatedState).toEqual(initialState);
  });

  it('should update non-dirty fields on SYNC_CARD', () => {
    const initialState = dirtyState(
      15,
      { _id: 'abc', question: 'Question A', answer: 'Answer' },
      toDirtyFields('question')
    );
    const change: CardChange = {
      card: {
        ...generateCard('abc'),
        question: 'Question B',
        answer: 'Answer B',
      },
    };

    const updatedState = subject(initialState, actions.syncEditCard(change));

    expect(updatedState).toEqual(
      dirtyState(
        15,
        { ...change.card, question: 'Question A' },
        toDirtyFields('question')
      )
    );
  });

  it('should NOT update fields on SYNC_CARD when card IDs differ', () => {
    const initialState = dirtyState(
      15,
      { _id: 'abc', question: 'Question A', answer: 'Answer' },
      toDirtyFields('question')
    );
    const change: CardChange = {
      card: {
        ...generateCard('def'),
        question: 'Question B',
        answer: 'Answer B',
      },
    };

    const updatedState = subject(initialState, actions.syncEditCard(change));

    expect(updatedState).toEqual(initialState);
  });

  it(
    'should update to NOT_FOUND (deleted) state on SYNC_CARD' +
      ' (deleted: true)',
    () => {
      const initialState = dirtyState(
        15,
        { _id: 'abc', question: 'Question A', answer: 'Answer' },
        toDirtyFields('question')
      );
      const change: CardChange = {
        card: generateCard('abc'),
        deleted: true,
      };

      const updatedState = subject(initialState, actions.syncEditCard(change));

      expect(updatedState).toEqual(deletedState(15));
    }
  );

  it('should update to NOT_FOUND (deleted) state on DELETE_CARD', () => {
    const initialState = dirtyState(
      15,
      { _id: 'abc', question: 'Question', answer: 'Answer' },
      toDirtyFields('question')
    );

    const updatedState = subject(initialState, actions.deleteCard(15, 'abc'));

    expect(updatedState).toEqual(deletedState(15));
  });

  it('should update to EMPTY state on DELETE_CARD for unsaved card', () => {
    const initialState = dirtyState(
      89,
      { question: 'Question', answer: 'Answer' },
      toDirtyFields('question')
    );

    const updatedState = subject(initialState, actions.deleteCard(89));

    expect(updatedState).toEqual(emptyState(89));
  });

  it('should do nothing on DELETE_CARD if formId does not match', () => {
    const initialState = dirtyState(
      16,
      { _id: 'abc', question: 'Question', answer: 'Answer' },
      toDirtyFields('question')
    );

    const updatedState = subject(initialState, actions.deleteCard(15, 'abc'));

    expect(updatedState).toEqual(initialState);
  });

  it('should update notes when the context matches', () => {
    const initialState = emptyState(7);

    const updatedState = subject(
      initialState,
      noteActions.addNote({ screen: 'edit-card', cardFormId: 7 })
    );

    expect(updatedState.forms.active.notes).toHaveLength(1);
  });

  it('should do nothing on ADD_NOTE if formId does not match', () => {
    const initialState = emptyState(7);

    const updatedState = subject(
      initialState,
      noteActions.addNote({ screen: 'edit-card', cardFormId: 6 })
    );

    expect(updatedState).toEqual(initialState);
  });
});
