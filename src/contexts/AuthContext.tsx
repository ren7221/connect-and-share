import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AppRole = "super_admin" | "tuckshop_admin" | "employee" | null;

interface EmployeePermissions {
  view_only: boolean;
  edit_suppliers: boolean;
  manage_sessions: boolean;
  manage_price_list: boolean;
  manage_payments: boolean;
  update_supply_sales: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole;
  tuckshopId: string | null;
  permissions: EmployeePermissions | null;
  isOwner: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const defaultPermissions: EmployeePermissions = {
  view_only: true,
  edit_suppliers: false,
  manage_sessions: false,
  manage_price_list: false,
  manage_payments: false,
  update_supply_sales: false,
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  tuckshopId: null,
  permissions: null,
  isOwner: false,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole>(null);
  const [tuckshopId, setTuckshopId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<EmployeePermissions | null>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const metaLoadingRef = useRef(false);

  const doSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setTuckshopId(null);
    setPermissions(null);
    setIsOwner(false);
  }, []);

  const fetchUserMeta = useCallback(async (userId: string) => {
    metaLoadingRef.current = true;
    try {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      const userRole = (roleData?.role as AppRole) ?? null;
      setRole(userRole);

      if (userRole === "tuckshop_admin") {
        // Check owner first, then check if they're an admin via employees table
        const { data: shop } = await supabase
          .from("tuckshops")
          .select("id, status")
          .eq("owner_id", userId)
          .limit(1)
          .maybeSingle();

        if (shop) {
          if ((shop.status as string) === "suspended") {
            toast.error("Your tuckshop has been suspended. Contact support.");
            await doSignOut();
            return;
          }
          setTuckshopId(shop.id);
          setIsOwner(true);
        } else {
          // Multi-admin (promoted): check employees table
          const { data: emp } = await supabase
            .from("employees")
            .select("tuckshop_id")
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle();
          if (emp) {
            // Check suspension
            const { data: empShop } = await supabase
              .from("tuckshops")
              .select("id, status")
              .eq("id", emp.tuckshop_id)
              .maybeSingle();
            if (empShop && (empShop.status as string) === "suspended") {
              toast.error("Your tuckshop has been suspended. Contact support.");
              await doSignOut();
              return;
            }
            setTuckshopId(emp.tuckshop_id);
            setIsOwner(false);
          } else {
            setTuckshopId(null);
            setIsOwner(false);
          }
        }
        setPermissions(null);
      } else if (userRole === "employee") {
        const { data: emp } = await supabase
          .from("employees")
          .select("tuckshop_id, permissions")
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();

        if (emp) {
          // Check suspension
          const { data: empShop } = await supabase
            .from("tuckshops")
            .select("id, status")
            .eq("id", emp.tuckshop_id)
            .maybeSingle();
          if (empShop && (empShop.status as string) === "suspended") {
            toast.error("Your tuckshop has been suspended. Contact support.");
            await doSignOut();
            return;
          }
          setTuckshopId(emp.tuckshop_id);
          setPermissions(emp.permissions ? (emp.permissions as unknown as EmployeePermissions) : defaultPermissions);
          setIsOwner(false);
        } else {
          setTuckshopId(null);
          setPermissions(defaultPermissions);
          setIsOwner(false);
        }
      } else {
        setTuckshopId(null);
        setPermissions(null);
        setIsOwner(false);
      }
    } finally {
      metaLoadingRef.current = false;
    }
  }, [doSignOut]);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          fetchUserMeta(newSession.user.id).then(() => {
            if (mounted) setLoading(false);
          });
        } else {
          setRole(null);
          setTuckshopId(null);
          setPermissions(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      if (!mounted) return;
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        fetchUserMeta(existing.user.id).then(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserMeta]);

  return (
    <AuthContext.Provider value={{ user, session, role, tuckshopId, permissions, isOwner, loading, signOut: doSignOut }}>
      {children}
    </AuthContext.Provider>
  );
};
