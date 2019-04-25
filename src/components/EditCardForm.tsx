import * as React from 'react';

import { CardFaceEditControls } from './CardFaceEditControls';
import { KeywordSuggestionProvider } from './KeywordSuggestionProvider';
import { MenuButton } from './MenuButton';
import { MenuItem } from './MenuItem';
import { MenuItemLink } from './MenuItemLink';
import { SaveStatus } from './SaveStatus';
import { TagSuggestionProvider } from './TagSuggestionProvider';
import { TokenList } from './TokenList';

import { Card } from '../model';
import { SaveState } from '../edit/reducer';
import { URLFromRoute } from '../route/router';
import { StoreError } from '../store/DataStore';
import { KeywordSuggester } from '../suggestions/KeywordSuggester';

interface Props {
  active: boolean;
  card: Partial<Card>;
  saveState: SaveState;
  saveError?: StoreError;
  canDelete: boolean;
  onChange?: (topic: string, value: string | string[]) => void;
  onDelete: () => void;
  onAddReverse: (href: string) => void;
}

export interface EditCardFormInterface {
  focus: () => void;
}

const EditCardFormImpl: React.FC<Props> = (props, ref) => {
  const cardControlsRef = React.useRef<CardFaceEditControls>(null);

  React.useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        if (!cardControlsRef.current) {
          return;
        }

        cardControlsRef.current.focus();
      },
    }),
    [cardControlsRef.current]
  );

  const [keywordsText, setKeywordsText] = React.useState('');
  const [tagsText, setTagsText] = React.useState('');

  const addReverseLink = getAddReverseLink(props);
  const keywordSuggestions = KeywordSuggester.getSuggestionsFromCard(
    props.card
  );

  const onCardChange = React.useCallback(
    (field: 'front' | 'back', value: string | string[]) => {
      props.onChange && props.onChange(field, value);
    },
    [props.onChange]
  );

  const keywordsTokenListRef = React.useRef<TokenList>(null);
  const tagsTokenListRef = React.useRef<TokenList>(null);

  const onKeywordsClick = React.useCallback(
    onTokenListClick.bind(null, keywordsTokenListRef),
    [keywordsTokenListRef]
  );
  const onTagsClick = React.useCallback(
    onTokenListClick.bind(null, tagsTokenListRef),
    [tagsTokenListRef]
  );

  const onTokenListChange = React.useCallback(
    (
      field: 'keywords' | 'tags',
      tokens: string[],
      addedTokens: string[],
      addRecentEntry: (entry: string) => void
    ) => {
      if (props.onChange) {
        props.onChange(field, tokens);
      }

      for (const token of addedTokens) {
        addRecentEntry(token);
      }
    },
    [props.onChange]
  );

  return (
    <>
      <form className="form editcard-form" autoComplete="off">
        <MenuButton
          id="card-edit-menu"
          className="button menubutton -icon -dotdotdot -grey -borderless -nolabel -large"
        >
          <MenuItemLink
            className="-iconic -add-reversed"
            label="Add reverse card"
            accelerator="Ctrl+Shift+X"
            disabled={!addReverseLink}
            href={addReverseLink || ''}
          />
          <MenuItem
            className="-iconic -delete"
            label="Delete"
            disabled={!props.canDelete}
            onClick={props.onDelete}
          />
        </MenuButton>
        <CardFaceEditControls
          card={props.card}
          onChange={onCardChange}
          ref={cardControlsRef}
        />
        <div
          className="keywords -yellow"
          onClick={onKeywordsClick}
          title="Words to cross-reference with notes and other resources"
        >
          <span className="icon -key" />
          <KeywordSuggestionProvider
            text={keywordsText}
            defaultSuggestions={keywordSuggestions}
            includeRecentKeywords={true}
          >
            {(
              suggestions: string[],
              loading: boolean,
              addRecentEntry: (entry: string) => void
            ) => (
              <TokenList
                className="tokens -yellow -seamless"
                tokens={props.card.keywords || []}
                placeholder="Keywords"
                onTokensChange={(keywords: string[], addedKeywords: string[]) =>
                  onTokenListChange(
                    'keywords',
                    keywords,
                    addedKeywords,
                    addRecentEntry
                  )
                }
                onTextChange={setKeywordsText}
                suggestions={suggestions}
                loadingSuggestions={loading}
                ref={keywordsTokenListRef}
              />
            )}
          </KeywordSuggestionProvider>
        </div>
        <div
          className="tags"
          onClick={onTagsClick}
          title="Labels to help organize your cards"
        >
          <span className="icon -tag -grey" />
          <TagSuggestionProvider text={tagsText}>
            {(
              suggestions: string[],
              loading: boolean,
              addRecentEntry: (entry: string) => void
            ) => (
              <TokenList
                className="tokens -seamless"
                tokens={props.card.tags || []}
                placeholder="Tags"
                onTokensChange={(tags: string[], addedTags: string[]) =>
                  onTokenListChange('tags', tags, addedTags, addRecentEntry)
                }
                onTextChange={setTagsText}
                suggestions={suggestions}
                loadingSuggestions={loading}
                ref={tagsTokenListRef}
              />
            )}
          </TagSuggestionProvider>
        </div>
      </form>
      <SaveStatus
        className="savestate"
        saveState={props.saveState}
        saveError={props.saveError ? props.saveError.message : undefined}
      />
    </>
  );
};

function getAddReverseLink(props: Props): string | null {
  if (!props.card.front || !props.card.back) {
    return null;
  }

  return URLFromRoute({
    screen: 'edit-card',
    search: {
      front: props.card.back || undefined,
      back: props.card.front || undefined,
      keywords: props.card.keywords || undefined,
      tags: props.card.tags || undefined,
    },
  });
}

function onTokenListClick(
  tokenListRef: React.RefObject<TokenList>,
  e: React.MouseEvent<HTMLDivElement>
) {
  if (!e.defaultPrevented && tokenListRef.current) {
    tokenListRef.current.focus();
  }
}

export const EditCardForm = React.forwardRef<EditCardFormInterface, Props>(
  EditCardFormImpl
);
