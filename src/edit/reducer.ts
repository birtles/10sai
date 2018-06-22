import deepEqual from 'deep-equal';
import EditorState from './EditorState';
import { Card, Note } from '../model';
import * as actions from './actions';
import { StoreError } from '../store/DataStore';

// (Eventual) Editing state shape:
//
// {
//   forms: {
//     active: {
//       formId: card ID or a sequence number (for yet-to-be-saved cards),
//       editorState: EditorState,
//       card: { _id: ..., question: ..., ... },
//       dirtyFields: [ 'question', 'question' etc. ]
//     }
//     [ next: { " " } ]
//     [ prev: { " " } ]
//   }
//   [ saveError ]
// }

export type FormId = string | number;

export interface EditFormState {
  formId: string | number;
  // XXX Convert EditorState into an enum type?
  editorState: symbol;
  card: Partial<Card>;
  dirtyFields?: Array<keyof Card>;
  deleted?: boolean;
  notes: Array<EditNote>;
}

export const enum EditNoteState {
  Ok = 'ok',
  Dirty = 'dirty',
  Deleted = 'deleted',
}

export interface EditNote {
  note: Partial<Note>;
  noteState: EditNoteState;
}

export interface EditState {
  forms: {
    active: EditFormState;
  };
  saveError?: StoreError;
}

const initialState: EditState = {
  forms: {
    active: {
      formId: 0,
      editorState: EditorState.EMPTY,
      card: {},
      notes: [],
    },
  },
};

export function edit(
  state = initialState,
  action: actions.EditAction
): EditState {
  switch (action.type) {
    case 'NEW_CARD': {
      return {
        forms: {
          active: {
            formId: action.id,
            editorState: EditorState.EMPTY,
            card: {},
            notes: [],
          },
        },
      };
    }

    case 'LOAD_CARD': {
      return {
        forms: {
          active: {
            formId: action.id,
            editorState: EditorState.LOADING,
            card: {},
            notes: [],
          },
        },
      };
    }

    case 'FINISH_LOAD_CARD': {
      if (action.formId !== state.forms.active.formId) {
        return state;
      }

      return {
        forms: {
          active: {
            formId: action.card._id,
            editorState: EditorState.OK,
            card: action.card,
            notes: [],
          },
        },
      };
    }

    case 'FAIL_LOAD_CARD': {
      if (action.formId !== state.forms.active.formId) {
        return state;
      }

      const deleted = Boolean(
        action.error &&
          typeof action.error === 'object' &&
          action.error.reason === 'deleted'
      );
      return {
        forms: {
          active: {
            formId: action.formId,
            editorState: EditorState.NOT_FOUND,
            card: {},
            deleted,
            notes: [],
          },
        },
      };
    }

    case 'EDIT_CARD': {
      if (action.formId !== state.forms.active.formId) {
        return state;
      }

      if (process.env.NODE_ENV === 'development') {
        console.assert(
          !Object.keys(action.card).includes('progress') &&
            !Object.keys(action.card).includes('reviewed'),
          'Should not be passing review fields as part of editing a card'
        );
      }

      const dirtyFields = state.forms.active.dirtyFields || [];
      dirtyFields.push(
        ...(Object.keys(action.card) as Array<keyof Card>).filter(
          field =>
            field !== '_id' &&
            field !== 'modified' &&
            !deepEqual(action.card[field], state.forms.active.card[field]) &&
            // This use of indexOf is not awesome but generally dirtyFields will
            // be 0 ~ 1 items so it's probably ok.
            dirtyFields.indexOf(field) === -1
        )
      );

      return {
        forms: {
          active: {
            formId: action.formId,
            editorState: EditorState.DIRTY,
            card: { ...state.forms.active.card, ...action.card },
            dirtyFields,
            notes: state.forms.active.notes,
          },
        },
      };
    }

    case 'FINISH_SAVE_CARD': {
      if (
        action.formId !== state.forms.active.formId ||
        state.forms.active.deleted
      ) {
        return state;
      }

      const dirtyFields = (Object.keys(action.card) as Array<
        keyof Card
      >).filter(
        field =>
          field !== '_id' &&
          field !== 'modified' &&
          !deepEqual(action.card[field], state.forms.active.card[field])
      );
      const editorState = dirtyFields.length
        ? EditorState.DIRTY
        : EditorState.OK;

      const result: EditState = {
        forms: {
          active: {
            formId: action.card._id!,
            editorState,
            card: { ...action.card, ...state.forms.active.card },
            notes: state.forms.active.notes,
          },
        },
      };
      if (dirtyFields.length) {
        result.forms.active.dirtyFields = dirtyFields;
      }

      return result;
    }

    case 'FAIL_SAVE_CARD': {
      if (
        action.formId !== state.forms.active.formId ||
        state.forms.active.deleted
      ) {
        return state;
      }

      return { forms: state.forms, saveError: action.error };
    }

    case 'SYNC_EDIT_CARD': {
      if (action.change._id !== state.forms.active.card._id) {
        return state;
      }

      // XXX Does sync return an augmented type?
      if (action.change._deleted) {
        return {
          forms: {
            active: {
              formId: state.forms.active.formId,
              editorState: EditorState.NOT_FOUND,
              card: {},
              deleted: true,
              notes: [],
            },
          },
        };
      }

      const card: Partial<Card> = {};
      // XXX Work out how to annotate field as keyof Card so we can drop all the
      // type assertions below
      for (const field in action.change) {
        if (action.change.hasOwnProperty(field)) {
          card[field as keyof Card] =
            state.forms.active.dirtyFields &&
            state.forms.active.dirtyFields.includes(field as keyof Card)
              ? state.forms.active.card[field as keyof Card]
              : action.change[field as keyof Card];
        }
      }

      return {
        forms: {
          active: { ...state.forms.active, card },
        },
      };
    }

    case 'DELETE_EDIT_CARD': {
      if (action.formId !== state.forms.active.formId) {
        return state;
      }

      if (!state.forms.active.card._id) {
        return {
          forms: {
            active: {
              formId: action.formId,
              editorState: EditorState.EMPTY,
              card: {},
              notes: [],
            },
          },
        };
      }

      return {
        forms: {
          active: {
            formId: action.formId,
            editorState: EditorState.NOT_FOUND,
            card: {},
            deleted: true,
            notes: [],
          },
        },
      };
    }

    case 'ADD_EDIT_NOTE': {
      if (action.formId !== state.forms.active.formId) {
        return state;
      }

      const newNote: Partial<Note> = {};
      if (action.initialKeywords) {
        newNote.keywords = action.initialKeywords.slice();
      }

      return {
        forms: {
          active: {
            ...state.forms.active,
            notes: [
              ...state.forms.active.notes,
              {
                note: newNote,
                noteState: EditNoteState.Ok,
              },
            ],
          },
        },
      };
    }

    default:
      return state;
  }
}

export default edit;
