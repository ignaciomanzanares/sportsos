import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import { haceCuanto } from "./tiempo";

export function useComments(postId, clubId) {
  const [comments, setComments] = useState([]);
  const isReal = !!(postId && clubId);

  const load = useCallback(async () => {
    if (!isReal) return;
    const { data } = await supabase
      .from("post_comments")
      .select("id, author_name, text, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (data) setComments(data.map(c => ({
      id: c.id,
      author: c.author_name,
      text: c.text,
      time: haceCuanto(c.created_at),
    })));
  }, [postId, isReal]);

  useEffect(() => { load(); }, [load]);

  const addComment = async ({ authorName, text, authorId = null }) => {
    if (!text.trim()) return { ok: false };
    if (!isReal) {
      setComments(prev => [...prev, { id: Date.now(), author: authorName || "Yo", text, time: "Ahora" }]);
      return { ok: true };
    }
    const { data, error } = await supabase.from("post_comments").insert({
      post_id: postId,
      club_id: clubId,
      author_id: authorId,
      author_name: authorName || "Usuario",
      text,
    }).select().single();
    if (!error && data) {
      setComments(prev => [...prev, { id: data.id, author: data.author_name, text: data.text, time: "Ahora" }]);
      return { ok: true };
    }
    return { ok: false, error };
  };

  return { comments, addComment };
}

