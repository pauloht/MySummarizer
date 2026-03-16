/** 
 * HELPER: Converts Character XML string into a JS Array of objects
 */
export function parseCharacterXML(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    
    // Check for errors
    if (xmlDoc.querySelector("parsererror")) {
        console.error("Error parsing character XML");
        console.error(xmlString);
        return [];
    }

    // Get all <character> tags and map them to objects
    return Array.from(xmlDoc.getElementsByTagName("character")).map(char => ({
        name: char.querySelector("name")?.textContent || "",
        appearance: char.querySelector("appearance")?.textContent || "",
        personality: char.querySelector("personality")?.textContent || "",
        job: char.querySelector("job")?.textContent || ""
    }));
}

/** 
 * HELPER: Converts JS Array of characters back into an XML string
 */
export function serializeCharactersToXML(characterList) {
    let xml = `<characters>\n`;
    
    characterList.forEach(char => {
        xml += `  <character>
    <name>${char.name}</name>
    <appearance>${char.appearance}</appearance>
    <personality>${char.personality}</personality>
    <job>${char.job}</job>
  </character>\n`;
    });

    xml += `</characters>`;
    return xml;
}