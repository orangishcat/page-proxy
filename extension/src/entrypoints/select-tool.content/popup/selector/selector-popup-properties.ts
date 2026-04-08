import type { PropertyItem } from "@/lib/utils/element-info";
import { isSpecialPropertyKey } from "./preview-code";

const matchesSearchTerm = (item: PropertyItem, searchTerm: string) => {
  if (!searchTerm) {
    return true;
  }

  return item.key.toLowerCase().includes(searchTerm) || item.value.toLowerCase().includes(searchTerm);
};

export const resolveActivePropertyKey = (propertyItems: PropertyItem[], selectedPropertyKey: string | null) => {
  if (selectedPropertyKey && propertyItems.some((item) => item.key === selectedPropertyKey)) {
    return selectedPropertyKey;
  }

  return propertyItems[0]?.key ?? null;
};

export const resolveActivePropertyItem = (propertyItems: PropertyItem[], activePropertyKey: string | null) => {
  if (!activePropertyKey) {
    return null;
  }

  return propertyItems.find((property) => property.key === activePropertyKey) ?? null;
};

export const filterPropertyItems = (propertyItems: PropertyItem[], propertySearchTerm: string) => {
  const normalizedSearchTerm = propertySearchTerm.trim().toLowerCase();
  const specialPropertyItems = propertyItems.filter((item) => isSpecialPropertyKey(item.key));
  const nonSpecialPropertyItems = propertyItems.filter((item) => !isSpecialPropertyKey(item.key));

  return {
    filteredSpecialPropertyItems: specialPropertyItems.filter((item) => matchesSearchTerm(item, normalizedSearchTerm)),
    filteredNonSpecialPropertyItems: nonSpecialPropertyItems.filter((item) =>
      matchesSearchTerm(item, normalizedSearchTerm),
    ),
  };
};
