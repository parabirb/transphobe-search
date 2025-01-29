<script>
    // need this for doing stuff when the document loads
    import { onMount } from "svelte";
    // bloom filter libs for shinigami
    import { BloomFilter, CombinedBloomFilter } from "$lib/bloom-filter";
    // fflate lib to unzip
    import { unzipSync } from "fflate";
    // crx to zip
    import { crxToZip } from "$lib/unzip-crx";
    // sha256
    import { sha256 } from "js-sha256";

    // vars we need
    let opfsRoot;
    let state;
    let tphobeFilter;
    let tfriendlyFilter;
    let soupcanList;
    let progress = "N/A";
    let input;
    let user;
    let markedSoupcan;
    let tphobeShinigami;
    let tfriendlyShinigami;
    let reasonSoupcan;
    let timeSoupcan;

    // function that makes bloom filters from a blob (duh)
    async function filterFromBlob(blob) {
        // get the buffer
        const buffer = await blob.arrayBuffer();
        // create a combined filter and add the parts
        const filter = new CombinedBloomFilter();
        filter.parts = [
            new BloomFilter(new Int32Array(buffer.slice(0, 287552)), 20),
            new BloomFilter(new Int32Array(buffer.slice(287552)), 21),
        ];
        // return the filter
        return filter;
    }

    // function to load all the stuff
    async function loadStuff() {
        // first get handles for the shinigami eyes files
        let tphobeHandle = await opfsRoot.getFileHandle("transphobic.dat");
        let tfriendlyHandle = await opfsRoot.getFileHandle("t-friendly.dat");
        // then check for the soupcan handle
        let soupcanHandle = await opfsRoot.getFileHandle("soupcan.json");
        // make filters
        tphobeFilter = await filterFromBlob(await tphobeHandle.getFile());
        tfriendlyFilter = await filterFromBlob(await tfriendlyHandle.getFile());
        // load the soupcan list
        soupcanList = JSON.parse(await (await soupcanHandle.getFile()).text());
        // put all this stuff in the window so i can debug from the console
        window.tphobeFilter = tphobeFilter;
        window.tfriendlyFilter = tfriendlyFilter;
        window.soupcanList = soupcanList;
        window.sha256 = sha256;
    }

    // when we're mounted
    onMount(async () => {
        // get the opfs root
        opfsRoot = await navigator.storage.getDirectory();
        try {
            // try loading the stuff
            await loadStuff();
            // set the state to downloaded
            state = "downloaded";
        } catch {
            // if it fails we probably don't have the things downloaded
            state = "notDownloaded";
        }
    });

    // function to download the databases and load them
    async function download() {
        state = "downloading";
        // download shinigami eyes first
        progress = "downloading shinigami eyes...";
        const shinigamiBlob = await fetch(
            "https://cors-anywhere.herokuapp.com/https://clients2.google.com/service/update2/crx?response=redirect&os=linux&arch=x86-64&os_arch=x86-64&nacl_arch=x86-64&prod=chromiumcrx&prodchannel=unknown&prodversion=132.0.6834.94&acceptformat=crx2,crx3&x=id%3Dijcpiojgefnkmcadacmacogglhjdjphj%26uc"
        ).then((res) => res.blob());
        progress = "unzipping shinigami eyes...";
        const shinigami = unzipSync(
            crxToZip(new Uint8Array(await shinigamiBlob.arrayBuffer()))
        );
        progress = "saving the shinigami eyes data...";
        // open the first handle
        const transphobicHandle = await opfsRoot.getFileHandle(
            "transphobic.dat",
            { create: true }
        );
        // write to the handle
        let writable = await transphobicHandle.createWritable();
        await writable.write(shinigami["data/transphobic.dat"]);
        await writable.close();
        // open the second handle
        const tfriendlyHandle = await opfsRoot.getFileHandle("t-friendly.dat", {
            create: true,
        });
        // write to that handle too
        writable = await tfriendlyHandle.createWritable();
        await writable.write(shinigami["data/t-friendly.dat"]);
        await writable.close();
        // download soupcan next
        progress = "downloading the soupcan database...";
        const soupcan = await fetch(
            `https://soupcan-extension.s3.us-west-2.amazonaws.com/dataset_compressed.json?${new Date().getTime()}`
        ).then((res) => res.text());
        // save soupcan data
        progress = "saving the soupcan data...";
        const soupcanHandle = await opfsRoot.getFileHandle("soupcan.json", {
            create: true,
        });
        writable = await soupcanHandle.createWritable();
        await writable.write(soupcan);
        await writable.close();
        // load the data in
        progress = "loading all data...";
        await loadStuff();
        localStorage.setItem("downloadTime", new Date().toLocaleString());
        state = "downloaded";
    }

    // function to delete the databases
    async function del() {
        // delete everything
        await opfsRoot.removeEntry("transphobic.dat");
        await opfsRoot.removeEntry("t-friendly.dat");
        await opfsRoot.removeEntry("soupcan.json");
        // change the state
        state = "notDownloaded";
    }

    // function to search
    function search() {
        // first remove the @ if it's in there, trim, etc.
        user = input.value.trim().replace("@", "").toLowerCase();
        // set the input value to nothing
        input.value = "";
        // search soupcan
        let entry = soupcanList.entries[sha256(`${user}:${soupcanList.salt}`)];
        markedSoupcan = !!entry && entry?.label === "transphobe";
        if (markedSoupcan) {
            timeSoupcan = entry.time;
            reasonSoupcan = entry.reason;
        }
        // search shinigami
        tphobeShinigami = tphobeFilter.test(`twitter.com/${user}`);
        tfriendlyShinigami = tfriendlyFilter.test(`twitter.com/${user}`);
        // mark as searched
        state = "searched";
    }
</script>

<div class="min-h-screen flex flex-col items-center justify-center">
    <div
        class="lg:w-[50vw] md:w-[70vw] w-[90vw] flex flex-col items-center justify-center text-center hyphens-auto gap-2"
    >
        <h1 class="text-4xl font-semibold">transphobe db search</h1>
        {#if !state}
            <p>
                we're currently checking for databases and loading them in. this
                may take a bit.
            </p>
        {:else if state === "notDownloaded"}
            <p>
                before you can do a search, you'll need to download the
                databases. first, go to <a
                    target="_blank"
                    href="https://cors-anywhere.herokuapp.com/"
                    class="text-blue-600 underline decoration-wavy underline-offset-2"
                    >this link</a
                > and opt in. then, just click the button below to download the data.
            </p>
            <button
                on:click={download}
                class="py-1 px-4 rounded-full border-black border-2 transition-colors hover:text-gray-600 hover:border-gray-600"
                >download</button
            >
        {:else if state === "downloading"}
            <p>
                we're currently downloading the databases and loading them in.
                this may take a few minutes.
            </p>
            <p>
                progress: {progress}
            </p>
        {:else if state === "downloaded"}
            <p>
                welcome! enter the username of the twitter user you want to
                search, then hit enter:
            </p>
            <input
                bind:this={input}
                id="username"
                placeholder="username..."
                class="rounded-full py-1 px-4 border-2 border-black"
                on:keydown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        search();
                    }
                }}
            />
            <p>
                date and time you last downloaded the databases: {localStorage.getItem(
                    "downloadTime"
                )}. if you'd like to delete the data to restart, click the
                button below.
            </p>
            <button
                on:click={del}
                class="py-1 px-4 rounded-full border-red-600 text-red-600 border-2 transition-colors hover:text-red-800 hover:border-red-800"
                >delete</button
            >
        {:else if state === "searched"}
            <p>
                results for <a
                    target="_blank"
                    href="https://x.com/{user}"
                    class="text-blue-600 underline decoration-wavy underline-offset-2"
                    >@{user}</a
                >:
            </p>
            <p>
                shinigami eyes
                {#if tfriendlyShinigami}
                    marked this user as <span class="text-green-600"
                        >trans friendly</span
                    >.
                {:else if tphobeShinigami}
                    marked this user as <span class="text-red-600"
                        >transphobic</span
                    >.
                {:else}
                    <span class="text-gray-600">did not mark this user</span>.
                {/if} please note that shinigami eyes uses bloom filters, which are
                prone to false positives.
            </p>
            <p>
                soupcan
                {#if markedSoupcan}
                    marked this user as <span class="text-red-600"
                        >transphobic</span
                    >. their reasoning was: "{reasonSoupcan.toLowerCase()}". the
                    entry
                    {#if timeSoupcan}
                        was made: {new Date(timeSoupcan).toLocaleString()}.
                    {:else}
                        was not timestamped.
                    {/if}
                {:else}
                    <span class="text-gray-600">did not mark this user</span>.
                {/if}
            </p>
            <button
                on:click={() => (state = "downloaded")}
                class="py-1 px-4 rounded-full border-black border-2 transition-colors hover:text-gray-600 hover:border-gray-600"
                >search again</button
            >
        {/if}
        <h6 class="text-sm">
            made by <a
                href="https://github.com/parabirb"
                class="text-blue-600 underline decoration-wavy underline-offset-2"
                >birb</a
            >.
        </h6>
    </div>
</div>
