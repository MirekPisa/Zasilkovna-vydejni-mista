import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type AppConfig = {
  id: string;
  shop_domain: string;
  packeta_api_key: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OrderPickup = {
  id: string;
  shop_domain: string;
  order_id: string;
  order_name: string;
  packeta_point_id: string;
  packeta_point_name: string;
  packeta_point_address: string;
  customer_email: string;
  created_at: string;
};
