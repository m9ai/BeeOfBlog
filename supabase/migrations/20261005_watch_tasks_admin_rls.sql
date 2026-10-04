-- ============================================================
-- 「小蜜蜂盯」后台管理员访问策略
--
-- 背景：
--   20261004_watch_tasks.sql 建表时只放行 service_role（与 mini_wishes 一致），
--   但后台是「管理员用自己的登录会话」访问数据的——和心愿单后台读 wishlist 表一样，
--   走的是 @/lib/supabase/server 的会话客户端，拿不到 service_role。
--
-- 因此这里补一层：管理员（user_roles.role = 'admin'）可读写盯事项 / 读附件 / 读对象存储。
--   - 表：SELECT / UPDATE（软删除、改状态都是 UPDATE）
--   - storage.objects：SELECT（会话客户端签发签名 URL 需要该权限）
-- 其余角色仍然一律拒绝，RLS 的对外封闭性不变。
--
-- 复用：is_admin() 用 SECURITY DEFINER，避免 policy 里子查询 user_roles 时
--       又被 user_roles 自身的 RLS 递归拦掉。
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ---------------------------------------------------------------- 表

DROP POLICY IF EXISTS watch_tasks_admin_select ON public.watch_tasks;
CREATE POLICY watch_tasks_admin_select
  ON public.watch_tasks
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS watch_tasks_admin_update ON public.watch_tasks;
CREATE POLICY watch_tasks_admin_update
  ON public.watch_tasks
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS watch_attachments_admin_select ON public.watch_attachments;
CREATE POLICY watch_attachments_admin_select
  ON public.watch_attachments
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------- 对象存储
-- storage schema 在非 Supabase 环境可能不存在，用 DO 块静默跳过（与建桶脚本一致）

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage'
  ) THEN
    EXECUTE '
      DROP POLICY IF EXISTS watch_media_admin_select ON storage.objects;
      CREATE POLICY watch_media_admin_select
        ON storage.objects
        FOR SELECT
        TO authenticated
        USING (bucket_id = ''watch-media'' AND public.is_admin());
    ';
  END IF;
END $$;
