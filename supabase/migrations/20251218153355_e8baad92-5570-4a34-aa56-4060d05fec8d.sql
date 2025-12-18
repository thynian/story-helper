-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create stories table
CREATE TABLE public.stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_text TEXT NOT NULL,
    optimised_text TEXT,
    structured_story JSONB,
    analysis_issues JSONB DEFAULT '[]'::jsonb,
    rewrite_candidates JSONB DEFAULT '[]'::jsonb,
    acceptance_criteria JSONB DEFAULT '[]'::jsonb,
    quality_report JSONB,
    user_decisions JSONB DEFAULT '[]'::jsonb,
    project_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create story_versions table for version history
CREATE TABLE public.story_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
    version_number INTEGER NOT NULL,
    original_text TEXT NOT NULL,
    optimised_text TEXT,
    structured_story JSONB,
    analysis_issues JSONB DEFAULT '[]'::jsonb,
    rewrite_candidates JSONB DEFAULT '[]'::jsonb,
    acceptance_criteria JSONB DEFAULT '[]'::jsonb,
    quality_report JSONB,
    user_decisions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (story_id, version_number)
);

-- Enable RLS
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins can access stories
CREATE POLICY "Admins can view all stories"
ON public.stories FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert stories"
ON public.stories FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update stories"
ON public.stories FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete stories"
ON public.stories FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS for story_versions
CREATE POLICY "Admins can view story versions"
ON public.story_versions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert story versions"
ON public.story_versions FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS for user_roles (admins can manage)
CREATE POLICY "Admins can view roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow users to check their own role
CREATE POLICY "Users can view own role"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Function to create version on story update
CREATE OR REPLACE FUNCTION public.create_story_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_version INTEGER;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
    FROM public.story_versions
    WHERE story_id = OLD.id;
    
    INSERT INTO public.story_versions (
        story_id, version_number, original_text, optimised_text,
        structured_story, analysis_issues, rewrite_candidates,
        acceptance_criteria, quality_report, user_decisions
    ) VALUES (
        OLD.id, next_version, OLD.original_text, OLD.optimised_text,
        OLD.structured_story, OLD.analysis_issues, OLD.rewrite_candidates,
        OLD.acceptance_criteria, OLD.quality_report, OLD.user_decisions
    );
    
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Trigger to create version before update
CREATE TRIGGER story_version_trigger
BEFORE UPDATE ON public.stories
FOR EACH ROW
EXECUTE FUNCTION public.create_story_version();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;