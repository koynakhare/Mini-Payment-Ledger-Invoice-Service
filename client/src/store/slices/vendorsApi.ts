import { GRAPHQL_OPERATIONS, RTK_TAG_TYPES } from '../../constants/apiEndpoints';
import type { CreateVendorInput, Vendor } from '../../types';
import { baseApi } from '../../api/baseApi';
import {
  gqlMutation,
  gqlQuery,
  graphqlEndpoint,
  graphqlEndpointVoid,
} from '../../api/graphql/endpointHelpers';
import { VENDOR_FIELDS } from '../../api/graphql/fragments';

export const vendorsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getVendors: builder.query<Vendor[], void>({
      queryFn: graphqlEndpointVoid<{ vendors: Vendor[] }, Vendor[]>(
        gqlQuery(GRAPHQL_OPERATIONS.QUERIES.GET_VENDORS, `vendors { ${VENDOR_FIELDS} }`),
        (data) => (Array.isArray(data.vendors) ? data.vendors : [])
      ),
      providesTags: [RTK_TAG_TYPES.VENDOR],
    }),

    createVendor: builder.mutation<Vendor, CreateVendorInput>({
      queryFn: graphqlEndpoint<
        CreateVendorInput,
        { createVendor: Vendor },
        Vendor
      >(
        (input) => ({
          document: gqlMutation(
            GRAPHQL_OPERATIONS.MUTATIONS.CREATE_VENDOR,
            `createVendor(input: $input) { ${VENDOR_FIELDS} }`,
            '$input: CreateVendorInput!'
          ),
          variables: { input },
        }),
        (data) => data.createVendor
      ),
      invalidatesTags: [RTK_TAG_TYPES.VENDOR, RTK_TAG_TYPES.ACCOUNT],
    }),
  }),
});

export const { useGetVendorsQuery, useCreateVendorMutation } = vendorsApi;
