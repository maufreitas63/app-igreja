export type KnowledgeArticle = {
  id: string;
  slug: string;
  title: string;
  question: string;
  body: string;
  route_key: string;
  tenant_id: string | null;
  is_published: boolean;
  sort_order: number;
  role_codes: string[];
};

export type KnowledgeListItem = Pick<
  KnowledgeArticle,
  'id' | 'slug' | 'title' | 'question' | 'body' | 'route_key' | 'sort_order'
>;

export type KnowledgeEditorCapabilities = {
  can_edit: boolean;
  can_edit_platform: boolean;
  can_edit_tenant: boolean;
};

export type KnowledgeMutationResult = {
  success: boolean;
  message: string;
  article?: KnowledgeArticle | null;
};
