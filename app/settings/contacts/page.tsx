'use client';

import { useCrm } from '@/hooks/use-crm';
import { ContactsView } from '@/components/contacts-view';

export default function ContactsSettingsPage() {
  const {
    contacts,
    tags,
    deleteContact,
    createTag,
    deleteTag,
    addTagToContact,
    removeTagFromContact,
    search,
    updateContact,
  } = useCrm();

  return (
    <div className="container mx-auto py-8 max-w-[1400px]">
      <ContactsView
        contacts={contacts}
        tags={tags}
        deleteContact={deleteContact}
        createTag={createTag}
        deleteTag={deleteTag}
        addTagToContact={addTagToContact}
        removeTagFromContact={removeTagFromContact}
        search={search}
        updateContact={updateContact}
        showHeader={true}
      />
    </div>
  );
}
