import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import { MOCK_POSTS } from "../data/mockData";
import { haceCuanto } from "./tiempo";

/**
 * Hook para El Muro — carga posts desde Supabase.
 * Sin club_id (demo/preview) usa la vitrina; con club_id, siempre lo real (aunque esté vacío).
 */
export function usePosts(clubId, userId=null) {
  const [posts,   setPosts]   = useState(clubId ? [] : MOCK_POSTS);
  const [likedByMe, setLikedByMe] = useState({}); // { [postId]: true }
  const isReal = !!clubId;

  const load = useCallback(async () => {
    if (!isReal) { setPosts(MOCK_POSTS); return; }
    try {
      const { data, error } = await supabase
        .from("posts")
        // El nombre de la clave foránea va explícito: desde que existen
        // post_likes y post_comments hay tres caminos de posts a profiles
        // (autor, quién dio like, quién comentó) y PostgREST se negaba a
        // adivinar — devolvía 300 PGRST201 y El Muro quedaba vacío para
        // siempre, sin ningún aviso en pantalla.
        .select("*, profiles!posts_author_id_fkey(nombre, rol)")
        .eq("club_id", clubId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;

      const ids = data.map(p => p.id);
      let likeCounts = {}, mine = {};
      if (ids.length > 0) {
        const { data: likes } = await supabase.from("post_likes").select("post_id, user_id").in("post_id", ids);
        (likes || []).forEach(l => {
          likeCounts[l.post_id] = (likeCounts[l.post_id] || 0) + 1;
          if (userId && l.user_id === userId) mine[l.post_id] = true;
        });
      }
      setLikedByMe(mine);

      // Normalizar al mismo formato que los mock posts
      const normalized = data.map(p => ({
        id:     p.id,
        type:   p.type,
        author: p.profiles?.nombre || "Usuario",
        time:   haceCuanto(p.created_at),
        text:   p.text,
        likes:  likeCounts[p.id] || 0,
      }));
      setPosts(normalized);
    } catch {
      setPosts([]);
    }
  }, [clubId, isReal, userId]);

  const toggleLike = async (postId) => {
    if (!isReal || !userId) return;
    const already = likedByMe[postId];
    // El contador se mueve antes de que conteste el servidor, que es lo correcto
    // para que el toque se sienta instantáneo. Lo que faltaba era deshacerlo
    // cuando la escritura no entra: el corazón quedaba encendido y el número
    // subido hasta que alguien recargara, y el "me gusta" no existía.
    const optimista = () => {
      if (already) {
        setLikedByMe(prev => { const n = { ...prev }; delete n[postId]; return n; });
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: Math.max(0, p.likes - 1) } : p));
      } else {
        setLikedByMe(prev => ({ ...prev, [postId]: true }));
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: p.likes + 1 } : p));
      }
    };
    const revertir = () => {
      if (already) {
        setLikedByMe(prev => ({ ...prev, [postId]: true }));
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: p.likes + 1 } : p));
      } else {
        setLikedByMe(prev => { const n = { ...prev }; delete n[postId]; return n; });
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes: Math.max(0, p.likes - 1) } : p));
      }
    };
    optimista();
    const { error } = already
      ? await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId)
      : await supabase.from("post_likes").insert({ post_id: postId, user_id: userId });
    if (error) revertir();
  };

  useEffect(() => { load(); }, [load]);

  // Suscripción en tiempo real
  useEffect(() => {
    if (!isReal) return;
    const channel = supabase
      .channel(`posts:${clubId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "posts",
        filter: `club_id=eq.${clubId}`,
      }, (payload) => {
        const p = payload.new;
        setPosts(prev => [{
          id: p.id, type: p.type, author: "Nuevo post",
          time: "Ahora", text: p.text, likes: 0,
        }, ...prev]);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [clubId, isReal]);

  const createPost = async ({ authorId, text, type = "general" }) => {
    if (!isReal) {
      const mock = { id: Date.now(), type, author: "Yo", time: "Ahora", text, likes: 0 };
      setPosts(p => [mock, ...p]);
      return mock;
    }
    const { data, error } = await supabase
      .from("posts")
      .insert({ club_id: clubId, author_id: authorId, text, type })
      .select().single();
    if (error) throw error;
    await load();
    return data;
  };

  return { posts, createPost, toggleLike, likedByMe, reload: load };
}

