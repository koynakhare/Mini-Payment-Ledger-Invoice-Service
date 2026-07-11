import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { RTK_TAG_TYPES } from '../constants/apiEndpoints';

export const invalidationTags = [
  RTK_TAG_TYPES.INVOICE,
  RTK_TAG_TYPES.ACCOUNT,
  RTK_TAG_TYPES.VENDOR,
  RTK_TAG_TYPES.LEDGER_INTEGRITY,
] as const;

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fakeBaseQuery(),
  tagTypes: [
    RTK_TAG_TYPES.ACCOUNT,
    RTK_TAG_TYPES.VENDOR,
    RTK_TAG_TYPES.INVOICE,
    RTK_TAG_TYPES.LEDGER_INTEGRITY,
  ],
  endpoints: () => ({}),
});
