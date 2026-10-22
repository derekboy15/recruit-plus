import type { RulesData, StratagemOut } from '@recruit/data/model';

const text = (v: string) => ({ t: 'text' as const, v });
const section = (id: string, title: string, body: string) => ({ id, title, blocks: [{ t: 'p' as const, c: [text(body)] }], text: body });

export const rulesData: RulesData = {
  articles: [
    {
      id: 'shooting-phase',
      title: 'Shooting phase',
      order: 5,
      summary: 'Choosing targets, rolling to hit and wound.',
      intro: [{ t: 'p', c: [text('Your units shoot one at a time.')] }],
      sections: [
        section('look-out-sir', 'Look Out, Sir', 'You cannot shoot at an enemy CHARACTER with 9 or fewer wounds while it is within 3" of a friendly unit, unless it is the closest target.'),
        section('blast', 'Blast', 'Blast weapons always make at least 3 attacks against units of 6 or more models.'),
      ],
    },
    {
      id: 'charge-phase',
      title: 'Charge phase',
      order: 6,
      summary: 'Charging, Overwatch and Heroic Interventions.',
      intro: [],
      sections: [
        section('overwatch', 'Overwatch', 'When an enemy unit declares a charge, one unit it targets can shoot at it first, hitting only on 6s.'),
        section('engagement-range', 'Engagement Range', 'A model is within Engagement Range of another if it is within 1" horizontally and 5" vertically.'),
      ],
    },
  ],
  glossary: [
    { id: 'core', term: 'CORE', blocks: [{ t: 'p', c: [text('A keyword on rank-and-file units.')] }], text: 'A keyword on rank-and-file units.' },
    { id: 'tau', term: "T'au", blocks: [{ t: 'p', c: [text('A Xenos empire.')] }], text: 'A Xenos empire.' },
  ],
};

export const coreStratagems: StratagemOut[] = [
  {
    id: '000002134006',
    name: 'Fire Overwatch',
    cp: '1',
    group: 'Core Book',
    kind: 'Core',
    phases: ['Enemy Charge phase'],
    text: 'Use this Stratagem after an enemy unit declares a charge against one or more units from your army.',
    plain: 'After an enemy unit declares a charge against your units, one of the charged units can shoot at it first.',
  },
  {
    id: '000008013002',
    name: 'Warlord Trait',
    cp: '1',
    group: 'Arks of Omen',
    kind: 'Requisition',
    phases: ['Before battle'],
    text: 'Use this Stratagem before the battle, when you select your WARLORD.',
  },
];
