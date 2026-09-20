import { useCallback, useEffect, useState } from "react";
import { useApi } from "~/api/useApi";
import { GET_TAGS, CREATE_TAG } from "~/api/queries";
import type { TagOption } from "./TagPicker";

/**
 * Loads the user's shared tag vocabulary and exposes a create-and-return helper
 * so any form's TagPicker can mint a brand-new tag inline (time-themes.md §7).
 * Keeps every form's tag state identical instead of hand-rolling GET_TAGS in
 * each one.
 */
export function useTagVocabulary() {
  const { call } = useApi();
  const [availableTags, setAvailableTags] = useState<TagOption[]>([]);

  useEffect(() => {
    call({ query: GET_TAGS }).then((res) => setAvailableTags(res?.tags ?? []));
  }, [call]);

  const createTag = useCallback(
    async (name: string, color: string): Promise<TagOption | null> => {
      const res = await call({ query: CREATE_TAG, variables: { name, color } });
      const tag = res?.createTag as TagOption | undefined;
      if (!tag) return null;
      setAvailableTags((prev) => (prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]));
      return tag;
    },
    [call]
  );

  return { availableTags, createTag };
}
