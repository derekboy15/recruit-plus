/** Generic BattleScribe XML element. */
export interface RawNode {
  tag: string;
  attrs: Record<string, string>;
  children: RawNode[];
  /** Text content for leaf elements such as <description> and <characteristic>. */
  text?: string;
}

export interface RawCatalogue {
  id: string;
  name: string;
  library: boolean;
  root: RawNode;
  links: { targetId: string; importRootEntries: boolean }[];
}

export interface GameData {
  system: RawCatalogue;
  catalogues: Map<string, RawCatalogue>;
}
