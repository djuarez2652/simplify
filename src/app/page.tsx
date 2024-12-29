'use client'
import {useEffect, useState} from "react";
import LinearProgress from '@mui/material/LinearProgress';
import {CircularProgress} from "@mui/material";

export default function Home() {

    const [accessToken, setAccessToken] = useState<string>("");
    const [tracks, setTracks] = useState([[]]);
    const [page, setPage] = useState(0);
    const [nextSongs, setNextSongs] = useState<string>("");
    const [initData, setInitData] = useState({});
    const [pagesLoaded, setPagesLoaded] = useState(0);
    const [userData, setUserData] = useState({});
    const [playlistName, setPlaylistName] = useState("");
    const [link, setLink] = useState("");
    const [offset, setOffset] = useState(0);

    const handleAuthorization = () => {
        let url = "https://accounts.spotify.com/authorize";
        const client_id = process.env.NEXT_PUBLIC_CLIENT_ID || "";
        const redirect_uri = "http://localhost:3000/";
        const scope = "user-read-private user-read-email user-library-read playlist-modify-public";

        url += "?response_type=token";
        url += "&client_id=" + encodeURIComponent(client_id);
        url += "&scope=" + encodeURIComponent(scope);
        url += "&redirect_uri=" + encodeURIComponent(redirect_uri);

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        window.location = url;

    }

    const getUserInfo = async () => {
        const resposne = await fetch("https://api.spotify.com/v1/me", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        })

        if (resposne.status === 200) {
            const data = await resposne.json();
            console.log('user', data);
            setUserData(data);
        }
    }

    useEffect(() => {
        if (!accessToken) return;
        getUserInfo();
    }, [accessToken]);


    useEffect(() => {
        function getHashParams() {
            let hashParams = {};
            let e, r = /([^&;=]+)=?([^&;]*)/g,
                q = window.location.hash.substring(1);
            while ( e = r.exec(q)) {
                // @ts-ignore
                hashParams[e[1]] = decodeURIComponent(e[2]);
            }
            return hashParams;
        }

        if (accessToken) return;

        const params = getHashParams();
        if (params && params?.access_token) {
            setAccessToken(params.access_token);
        }
    }, []);


    const handleLikedSongs = async () => {
        if (!accessToken) return;

        const response = await fetch("https://api.spotify.com/v1/me/tracks", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        })

        if (response.status === 200) {
            const data = await response.json();

            console.log(data)

            const tracks = data.items.map((info: any) => {
                const track = info.track;
                return track;
            })

            setTracks(reorderTracks(tracks));
            setNextSongs(data.next);
            setInitData(data)
            setPagesLoaded(prev => prev+1);

        }
    }

    const reorderTracks = (tracks) => {
        const groupedTracks = [];
        let currentGroup = [];

        tracks.forEach((track, index) => {
            currentGroup.push(track);
            if (currentGroup.length === 10 || index === tracks.length - 1) {
                groupedTracks.push(currentGroup);
                currentGroup = [];
            }
        });

        return groupedTracks;
    }

    const handlePrevPage = () => {
        if (page <= 0) return;
        setPage(prev => prev - 1);
    }

    const handleNextPage = () => {
        if (page >= tracks.length - 1) return;
        setPage(prev => prev + 1);
    }

    useEffect(() => {
        if (!accessToken) return;
        fetchNextSongs();

    }, [initData, page]);


    const fetchNextSongs = async () => {
        if (pagesLoaded - page < 2) {
            console.log('next songs')
            const response = await fetch(nextSongs, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${accessToken}`
                }
            })

            if (response.status === 200) {
                console.log('found next tracks')
                const data = await response.json();

                const next_tracks = data.items.map((info: any) => {
                    const track = info.track;
                    return track;
                })

                console.log('next tracks are', next_tracks)

                setTracks(prev => [...prev, ...reorderTracks(next_tracks)]);
                setNextSongs(data.next);
                setPagesLoaded(prev => prev + Math.ceil(next_tracks.length/10));
            }
        }
    }

    useEffect(() => {
        console.log(nextSongs);
    }, [nextSongs]);


    const fetchRestOfSongs = async () => {
        let nextLink = nextSongs;
        let newTracks = tracks;
        let count = 0;
        while (nextLink !== null) {
            if (count % 10 == 0) {
                await new Promise(r => setTimeout(r, 10));
            }
            console.log('checking', nextLink);
            const response = await fetch(nextLink, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${accessToken}`
                }
            })

            if (response.status === 200) {
                // console.log('found next tracks')
                const data = await response.json();
                // console.log(data)

                const next_tracks = data.items.map((info: any) => {
                    const track = info.track;
                    return track;
                })

                // console.log('next tracks are', next_tracks)

                newTracks = [...newTracks, ...reorderTracks(next_tracks)];
                nextLink = data.next;
                setOffset((data.offset/data.total) * 100)
            }
        }
        console.log('new length', newTracks.length);
        setTracks(newTracks);
        return newTracks
    }

    useEffect(() => {
        console.log('update off', offset)
    }, [offset]);

    const handleImport = async () => {

        // console.log('getting the rest of the songs')
        //
        // let count = page;
        // while (nextSongs) {
        //     if (count > 200) break;
        //     console.log('got batch', count, tracks)
        //     count += 1
        //     fetchNextSongs();
        //     // console.log('next songs', nextSongs)
        // }

        // const flatten = tracks.reduce((acc, list) => acc.concat(list), []);
        // console.log('flatten', flatten, initData.total);
        const all_tracks = await fetchRestOfSongs();

        console.log('finished getting tracks')
        console.log('total batches are', all_tracks.length);


        console.log('creating playlist', playlistName, 'for', userData.id);
        const response = await fetch(`https://api.spotify.com/v1/users/${userData.id}/playlists`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "name": playlistName,
                "description": "A public playlist of your liked songs. Made by Simplify by David Juarez."
            })
        })

        if (response.status === 201) {
            const data = await response.json();
            console.log('playlist data', data);
            setPlaylistName("")


            const flatten = all_tracks.reduce((acc, list) => acc.concat(list), []);

            for (let i = 0; i < Math.ceil(flatten.length / 100); i++) {
                const uris = flatten.map(track => track.uri).slice(i, i+100);

                console.log('uris uploaded', uris);
                console.log('adding songs')
                const res = await fetch(`https://api.spotify.com/v1/playlists/${data.id}/tracks`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        "uris": uris
                    })
                })

                if (res.status === 201) {
                    console.log('added 100 songs')
                } else {
                    console.log('failed to add songs')
                }
            }

            setLink(data.external_urls.spotify)
        } else {
            console.log('playlist creation error', response.status);
        }
    }

    useEffect(() => {
        console.log(userData)
    }, [userData]);

    return (
        <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
            <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
                <div className="flex gap-4 items-center flex-col sm:flex-row">
                    <button
                        className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:min-w-44"
                        onClick={handleAuthorization}
                    >
                        Authorize
                    </button>
                    <button
                        className={`rounded-full border border-solid border-[#1db954] dark:border-[#1db954] transition-colors flex items-center justify-center text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 
  hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-[#33c065] disabled:border-black/[.08] disabled:dark:border-white/[.145] disabled:opacity-50 disabled:cursor-not-allowed`}
                        onClick={handleLikedSongs}
                        disabled={accessToken === ""}
                    >
                        Liked Songs
                    </button>
                </div>

                {
                    accessToken && tracks[0].length > 0 &&
                    <div className="text-sm sm:text-base max-w-[80%]">
                        <p className="mb-2">Your Songs: </p>
                        <ul className="w-[300px] sm:w-[400px]">
                        {
                                tracks[page].map((track, index) => {
                                    return (
                                        <li key={index}
                                            className="truncate max-w-[300px] sm:max-w-[400px] w-full">{track.name}</li>
                                    )
                                })
                            }
                        </ul>
                        <div className="flex flex-col items-center justify-center gap-4 mt-4">
                            <div
                                className="flex justify-center gap-4"
                            >
                                <button
                                    onClick={handlePrevPage}
                                    disabled={page === 0}
                                    className={`rounded-full border border-solid border-[#1db954] dark:border-[#1db954] transition-colors flex items-center justify-center text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 
        hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-[#33c065] 
        disabled:border-black/[.08] disabled:dark:border-white/[.145] disabled:opacity-50 disabled:cursor-not-allowed`}


                                >
                                    Prev
                                </button>
                                <button
                                    onClick={handleNextPage}
                                    disabled={page === tracks.length - 1}
                                    className={`rounded-full border border-solid border-[#1db954] dark:border-[#1db954] transition-colors flex items-center justify-center text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 
        hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-[#33c065] 
        disabled:border-black/[.08] disabled:dark:border-white/[.145] disabled:opacity-50 disabled:cursor-not-allowed`}


                                >
                                    Next
                                </button>
                            </div>
                            <p className="text-sm sm:text-base">
                                Page {page + 1} of {Math.ceil(initData.total / 10)}
                            </p>
                        </div>
                    </div>
                }
            </main>
            <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">

                {
                    tracks.length > 0 &&
                    <div
                        className="flex flex-col gap-4 items-center"
                    >
                        <button
                            className={`w-full rounded-full border border-solid border-[#1db954] dark:border-[#1db954] transition-colors flex items-center justify-center text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 
          hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-[#33c065] disabled:border-black/[.08] disabled:dark:border-white/[.145] disabled:opacity-50 disabled:cursor-not-allowed`}
                            onClick={handleImport}
                        >
                            Import All Songs
                        </button>
                        <input
                            value={playlistName}
                            onChange={(e) => setPlaylistName(e.target.value)}
                            className="rounded-lg border border-[#1db954] dark:border-[#1db954] bg-[#121212] text-white placeholder-gray-400 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#1db954]"
                            placeholder="Enter playlist name"
                            type="text"
                        />
                        {
                            offset > 0 && <CircularProgress variant="determinate" value={offset} />
                        }
                        {
                            link &&
                            <a
                                href={link}
                                target="_blank"
                                className="text-[#1db954] hover:text-[#33c065] underline transition-colors"
                            >
                                Open Playlist
                            </a>
                        }
                    </div>
                }
            </footer>
        </div>
    );
}
