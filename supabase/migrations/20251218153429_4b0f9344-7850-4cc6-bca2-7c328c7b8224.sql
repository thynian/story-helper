-- Allow anonymous inserts to stories (for auto-save from public wizard)
CREATE POLICY "Anyone can insert stories"
ON public.stories FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anonymous updates to stories
CREATE POLICY "Anyone can update stories"
ON public.stories FOR UPDATE
TO anon
USING (true);

-- Function to save story (callable by anyone, returns story id)
CREATE OR REPLACE FUNCTION public.save_story(
    p_original_text TEXT,
    p_optimised_text TEXT DEFAULT NULL,
    p_structured_story JSONB DEFAULT NULL,
    p_analysis_issues JSONB DEFAULT '[]'::jsonb,
    p_rewrite_candidates JSONB DEFAULT '[]'::jsonb,
    p_acceptance_criteria JSONB DEFAULT '[]'::jsonb,
    p_quality_report JSONB DEFAULT NULL,
    p_user_decisions JSONB DEFAULT '[]'::jsonb,
    p_project_id TEXT DEFAULT NULL,
    p_story_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_story_id UUID;
BEGIN
    IF p_story_id IS NOT NULL THEN
        -- Update existing story
        UPDATE public.stories SET
            original_text = p_original_text,
            optimised_text = p_optimised_text,
            structured_story = p_structured_story,
            analysis_issues = p_analysis_issues,
            rewrite_candidates = p_rewrite_candidates,
            acceptance_criteria = p_acceptance_criteria,
            quality_report = p_quality_report,
            user_decisions = p_user_decisions,
            project_id = COALESCE(p_project_id, project_id)
        WHERE id = p_story_id
        RETURNING id INTO v_story_id;
        
        IF v_story_id IS NULL THEN
            -- Story doesn't exist, create new
            INSERT INTO public.stories (
                original_text, optimised_text, structured_story,
                analysis_issues, rewrite_candidates, acceptance_criteria,
                quality_report, user_decisions, project_id
            ) VALUES (
                p_original_text, p_optimised_text, p_structured_story,
                p_analysis_issues, p_rewrite_candidates, p_acceptance_criteria,
                p_quality_report, p_user_decisions, p_project_id
            )
            RETURNING id INTO v_story_id;
        END IF;
    ELSE
        -- Create new story
        INSERT INTO public.stories (
            original_text, optimised_text, structured_story,
            analysis_issues, rewrite_candidates, acceptance_criteria,
            quality_report, user_decisions, project_id
        ) VALUES (
            p_original_text, p_optimised_text, p_structured_story,
            p_analysis_issues, p_rewrite_candidates, p_acceptance_criteria,
            p_quality_report, p_user_decisions, p_project_id
        )
        RETURNING id INTO v_story_id;
    END IF;
    
    RETURN v_story_id;
END;
$$;