// This type is based on a Notion database query response template.
// Only the relevant fields for your use case are included for brevity.

export type NotionResponse = {
  object: 'list';
  results: NotionPage[];
  next_cursor: string | null;
  has_more: boolean;
  type: 'page_or_database';
  page_or_database: Record<string, unknown>;
};

export type NotionPage = {
  object: 'page';
  id: string;
  created_time: string;
  last_edited_time: string;
  created_by?: NotionUser;
  last_edited_by?: NotionUser;
  cover?: NotionCover;
  icon?: NotionIcon;
  parent?: NotionParent;
  archived?: boolean;
  properties: Record<string, NotionProperty>;
  url: string;
};

export type NotionUser = {
  object: 'user';
  id: string;
  name?: string;
  avatar_url?: string;
  type?: string;
  person?: { email: string };
};

export type NotionCover = {
  type: 'external';
  external: { url: string };
};

export type NotionIcon = {
  type: 'emoji';
  emoji: string;
};

export type NotionParent = {
  type: 'database_id';
  database_id: string;
};

export type NotionProperty =
  | NotionTitleProperty
  | NotionNumberProperty
  | NotionDateProperty
  | NotionMultiSelectProperty
  | NotionSelectProperty
  | NotionPeopleProperty
  | NotionCheckboxProperty
  | NotionRollupProperty
  | NotionUrlProperty
  | NotionRelationProperty
  | NotionRichTextProperty
  | NotionFormulaProperty;

export type NotionTitleProperty = {
  id: string;
  type: 'title';
  title: NotionText[];
};

export type NotionText = {
  type: 'text';
  text: { content: string; link: string | null };
  annotations?: Record<string, unknown>;
  plain_text: string;
  href: string | null;
};

export type NotionNumberProperty = {
  id: string;
  type: 'number';
  number: number;
};

export type NotionDateProperty = {
  id: string;
  type: 'date';
  date: {
    start: string;
    end: string | null;
    time_zone?: string | null;
  };
};

export type NotionMultiSelectProperty = {
  id: string;
  type: 'multi_select';
  multi_select: Array<{ id: string; name: string; color: string }>;
};

export type NotionSelectProperty = {
  id: string;
  type: 'select';
  select: { id: string; name: string; color: string };
};

export type NotionPeopleProperty = {
  id: string;
  type: 'people';
  people: NotionUser[];
};

export type NotionCheckboxProperty = {
  id: string;
  type: 'checkbox';
  checkbox: boolean;
};

export type NotionRollupProperty = {
  id: string;
  type: 'rollup';
  rollup: {
    type: 'number';
    number: number;
    function: string;
  };
};

export type NotionUrlProperty = {
  id: string;
  type: 'url';
  url: string;
};

export type NotionRelationProperty = {
  id: string;
  type: 'relation';
  relation: Array<{ id: string }>;
  has_more: boolean;
};

export type NotionRichTextProperty = {
  id: string;
  type: 'rich_text';
  rich_text: NotionText[];
};

export type NotionFormulaProperty = {
  id: string;
  type: 'formula';
  formula: {
    type: 'number';
    number: number;
  };
};
