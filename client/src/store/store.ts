import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from '../api/baseApi';
import './slices';

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export {
  useApplyPaymentMutation,
  useCreateAccountMutation,
  useCreateInvoiceMutation,
  useCreateVendorMutation,
  useGetAccountStatementQuery,
  useGetAccountsQuery,
  useGetInvoiceQuery,
  useGetInvoicesQuery,
  useGetLedgerIntegrityQuery,
  useGetVendorsQuery,
  useMarkOverdueInvoicesMutation,
  useReversePaymentMutation,
  useSendInvoiceMutation,
  useVerifyLedgerIntegrityMutation,
} from './slices';
