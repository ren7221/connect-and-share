import React, { useEffect, useState } from "react";
import { Package, Clock, DollarSign, LogOut, User, Store, Truck, CreditCard } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useTuckshopBranding } from "@/hooks/useTuckshopBranding";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const items = [
  { title: "Sessions", url: "/employee", icon: Clock, requiredPerms: null },
  { title: "Supply Sales", url: "/employee/sales", icon: Package, requiredPerms: null },
  { title: "Price List", url: "/employee/prices", icon: DollarSign, requiredPerms: null },
  { title: "Suppliers", url: "/employee/suppliers", icon: Truck, requiredPerms: null },
  { title: "Payment Methods", url: "/employee/payments", icon: CreditCard, requiredPerms: ["manage_payments"] },
  { title: "Profile", url: "/employee/profile", icon: User, requiredPerms: null },
];

export const EmployeeSidebar = React.memo(function EmployeeSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut, permissions, role } = useAuth();
  const { branding } = useTuckshopBranding();
  const [profile, setProfile] = useState<{ full_name: string; avatar_url: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) setProfile({ full_name: data.full_name ?? "", avatar_url: (data as any).avatar_url ?? "" });
    });
  }, [user]);

  const handleLinkClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const filteredItems = items.filter(item => {
    if (!item.requiredPerms) return true;
    // Show item if the employee has ANY of the required permissions
    return item.requiredPerms.some(perm => (permissions as any)?.[perm] === true);
  });

  const initials = profile?.full_name?.split(" ").map(n => n[0]).join("").toUpperCase() || "U";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          {branding?.logo_url ? (
            <img src={branding.logo_url} alt={branding.name} className="h-9 w-9 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className="h-9 w-9 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Store className="h-5 w-5 text-primary" />
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-sidebar-foreground truncate">{branding?.name || "Tuckshop"}</p>
              <p className="text-[11px] text-sidebar-foreground/50 truncate">Employee Portal</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-accent/70 px-4 font-bold">
            {!collapsed && "Menu"}
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-1">
            <SidebarMenu>
              {filteredItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/employee"}
                      onClick={handleLinkClick}
                      className="hover:bg-sidebar-accent/60 rounded-lg transition-all duration-200 mx-2 px-3 py-2.5"
                      activeClassName="bg-accent/15 text-accent font-semibold shadow-sm border-l-2 border-accent"
                    >
                      <item.icon className="mr-3 h-4 w-4 flex-shrink-0" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <div className={`${!collapsed ? 'glass rounded-xl p-2 space-y-2' : 'flex flex-col items-center gap-2'}`}>
          {!collapsed && profile && (
            <div className="flex items-center gap-3 px-2 py-1.5 border-b border-sidebar-border/50 mb-1">
              <Avatar className="h-8 w-8 border border-sidebar-border">
                <AvatarImage src={profile.avatar_url} />
                <AvatarFallback className="text-[10px] bg-primary/20 text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{profile.full_name}</p>
                <p className="text-[10px] text-muted-foreground truncate capitalize">{role?.replace("_", " ")}</p>
              </div>
            </div>
          )}
          {collapsed && (
            <Avatar className="h-8 w-8 border border-sidebar-border mb-1">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback className="text-[10px] bg-primary/20 text-primary">{initials}</AvatarFallback>
            </Avatar>
          )}
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors">
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="text-sm">Sign Out</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
});
