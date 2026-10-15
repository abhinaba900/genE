import * as migration_20261014_084643_initial from './20261014_084643_initial';
import * as migration_20261014_085504_story_source_and_page_template from './20261014_085504_story_source_and_page_template';
import * as migration_20261014_110000_lockdown_and_indexes from './20261014_110000_lockdown_and_indexes';
import * as migration_20261014_111747_brand_name_defaults from './20261014_111747_brand_name_defaults';
import * as migration_20261014_131630_form_submissions_and_contact_fields from './20261014_131630_form_submissions_and_contact_fields';

export const migrations = [
  {
    up: migration_20261014_084643_initial.up,
    down: migration_20261014_084643_initial.down,
    name: '20261014_084643_initial',
  },
  {
    up: migration_20261014_085504_story_source_and_page_template.up,
    down: migration_20261014_085504_story_source_and_page_template.down,
    name: '20261014_085504_story_source_and_page_template',
  },
  {
    up: migration_20261014_110000_lockdown_and_indexes.up,
    down: migration_20261014_110000_lockdown_and_indexes.down,
    name: '20261014_110000_lockdown_and_indexes',
  },
  {
    up: migration_20261014_111747_brand_name_defaults.up,
    down: migration_20261014_111747_brand_name_defaults.down,
    name: '20261014_111747_brand_name_defaults',
  },
  {
    up: migration_20261014_131630_form_submissions_and_contact_fields.up,
    down: migration_20261014_131630_form_submissions_and_contact_fields.down,
    name: '20261014_131630_form_submissions_and_contact_fields'
  },
];
