// xmlUtils.js

/** 
 * HELPER: Converts XML string from Lorebook back into a JS Array
 */
export function parseExistingMemoryXML(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    
    if (xmlDoc.querySelector("parsererror")) return [];

    return Array.from(xmlDoc.getElementsByTagName("memory")).map(m => ({
        memoryOwner: m.querySelector("memoryOwner")?.textContent,
        shortDescription: m.querySelector("shortDescription")?.textContent,
        feelings: m.querySelector("feelings")?.textContent,
        perception: m.querySelector("perception")?.textContent,
        reasoning: m.querySelector("reasoning")?.textContent
    }));
}

/** 
 * HELPER: Converts JS Array back into an XML string for the Lorebook
 */
export function serializeMemoriesToXML(memoryOwner, list) {
    let xml = `<memories>\n`;
    list.forEach(m => {
        xml += `  <memory>
    <memoryOwner>${memoryOwner}</memoryOwner>
    <shortDescription>${m.shortDescription}</shortDescription>
    <feelings>${m.feelings}</feelings>
    <perception>${m.perception}</perception>
    <reasoning>${m.reasoning}</reasoning>
  </memory>\n`;
    });
    xml += `</memories>`;
    return xml;
}