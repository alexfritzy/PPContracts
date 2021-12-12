// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

interface IKeys {
    function ownerOf(uint256 tokenId) external view returns(address);
} 

interface IPirates {
    function totalSupply() external view returns(uint256);
    function mintWithChest(uint256 chestId, address chestOwner) external;
}

interface IBooty {
    function burn(address _from, uint256 _amount) external;
    function mint(address _to, uint256 _amount) external;
} 

contract Chests4 is ERC721, ERC721Enumerable, Ownable {
    using SafeMath for uint256;
    string public PROVENANCE;
    
    //Sale States
    bool public isKeyMintActive = false;
    bool public isAllowListActive = false;
    bool public isPublicSaleActive = false;
    
    //Key tracking
    IKeys public Keys;
    mapping(uint256 => bool) public keyUsed;
    
    //State tracking
    IPirates public Pirates;
    mapping(uint256 => bool) public chestOpened;
    event ChestOpened(uint256 chestId);
    
    //Booty
    IBooty public Booty;
    mapping(uint256 => uint256) public chestBalance;
    mapping(uint256 => uint256) public lastUpdate;
    event ChestBalanceUpdate(uint256 chestId, uint256 balance);
    
    //Privates
    string private _baseURIextended;
    mapping(address => uint8) public allowList;
    
    //Constants
    uint256 public constant MAX_SUPPLY = 4;
    uint256 public constant MAX_PUBLIC_MINT = 5;
    uint256 public constant PRICE_PER_TOKEN = 0.03 ether;
    uint256 public constant MAX_PIRATE_MINT = 10000;
    //In tenths of a percent
    uint256 public constant DAILY_RATE = 14;
    
    constructor() ERC721("Chests4", "CHESTS4") {
    }
    
    function setProvenance(string memory provenance) public onlyOwner {
        PROVENANCE = provenance;
    }

    //Key Minting
    function setKeys(address keysAddress) external onlyOwner {
        Keys = IKeys(keysAddress);
    }
    
    function setIsKeyMintActive(bool _isKeyMintActive) external onlyOwner {
        isKeyMintActive = _isKeyMintActive;
    }

    function mintWithKeys(uint256[] calldata keyIds) external {
        uint256 ts = totalSupply();
        require(isKeyMintActive, "Key mint is not active");        
        //"Purchase would exceed max tokens"
        require(ts + keyIds.length <= MAX_SUPPLY);
        
        for (uint256 i = 0; i < keyIds.length; i++) {
            require(Keys.ownerOf(keyIds[i]) == msg.sender, "Cannot redeem key you don't own");
            require(keyUsed[keyIds[i]] == false, "Key has been used");
            keyUsed[keyIds[i]] = true;
            _safeMint(msg.sender, ts + i);
        }
    }
    //

    //Allowed Minting
    function setIsAllowListActive(bool _isAllowListActive) external onlyOwner {
        isAllowListActive = _isAllowListActive;
    }

    function setAllowList(address[] calldata addresses, uint8 numAllowedToMint) external onlyOwner {
        for (uint256 i = 0; i < addresses.length; i++) {
            allowList[addresses[i]] = numAllowedToMint;
        }
    }

    function mintAllowList(uint8 numberOfTokens) external payable {
        uint256 ts = totalSupply();
        //"Allow list is not active"
        require(isAllowListActive);
        //"Exceeded max available to purchase"
        require(numberOfTokens <= allowList[msg.sender]);
        //"Purchase would exceed max tokens"
        require(ts + numberOfTokens <= MAX_SUPPLY);
        //"Ether value sent is not correct"
        require(PRICE_PER_TOKEN * numberOfTokens <= msg.value);

        allowList[msg.sender] -= numberOfTokens;
        for (uint256 i = 0; i < numberOfTokens; i++) {
            _safeMint(msg.sender, ts + i);
        }
    }
    //
    
    //Public Minting
    function setPublicSaleState(bool newState) public onlyOwner {
        isPublicSaleActive = newState;
    }

    function mintNFT(uint numberOfTokens) public payable {
        uint256 ts = totalSupply();
        //"Sale must be active to mint tokens"
        require(isPublicSaleActive);
        //"Exceeded max token purchase"
        require(numberOfTokens <= MAX_PUBLIC_MINT);
        //"Purchase would exceed max tokens"
        require(ts + numberOfTokens <= MAX_SUPPLY);
        //"Ether value sent is not correct"
        require(PRICE_PER_TOKEN * numberOfTokens <= msg.value);

        for (uint256 i = 0; i < numberOfTokens; i++) {
            _safeMint(msg.sender, ts + i);
        }
    }
    //
    
    //Opening
    function setPirates(address piratesAddress) external onlyOwner {
        Pirates = IPirates(piratesAddress);
    }
    
    function openChests(uint256[] calldata chestIds) external {
        for (uint256 i = 0; i < chestIds.length; i++) {
            require(ownerOf(chestIds[i]) == msg.sender, "Cannot interact with a chest you do not own");
            require(chestOpened[chestIds[i]] == false, "Chest already opened");
            chestOpened[chestIds[i]] = true;
            //NEEDS TESTING
            if (Pirates.totalSupply() < MAX_PIRATE_MINT) {
                Pirates.mintWithChest(chestIds[i], msg.sender);
            }
            emit ChestOpened(chestIds[i]);
            lastUpdate[chestIds[i]] = block.timestamp;
        }
    }
    //
    
    //Booty
    function setBooty(address bootyAddress) external onlyOwner {
        Booty = IBooty(bootyAddress);
    }
    
    function deposit(uint256 chestId, uint256 amount) external {
        require(msg.sender == ownerOf(chestId), "Cannot interact with a chest you do not own");
        require(chestOpened[chestId] == true, "Cannot deposit in a closed chest");
        chestBalance[chestId] += getPendingInterest(chestId);
        chestBalance[chestId] += amount;
        Booty.burn(msg.sender, amount);
        lastUpdate[chestId] = block.timestamp;
        emit ChestBalanceUpdate(chestId, chestBalance[chestId]);
    }
    
    function withdraw(uint256 chestId, uint256 amount) external {
        require(msg.sender == ownerOf(chestId), "Cannot interact with a chest you do not own");
        require(chestOpened[chestId] == true, "Cannot withdraw from a closed chest");
        require(chestBalance[chestId] >= amount, "Not enough Booty in chest");
        chestBalance[chestId] += getPendingInterest(chestId);
        chestBalance[chestId] -= amount;
        Booty.mint(msg.sender, amount);
        lastUpdate[chestId] = block.timestamp;
        emit ChestBalanceUpdate(chestId, chestBalance[chestId]);
    }
    
    function claimInterest(uint256 chestId) external {
        require(msg.sender == ownerOf(chestId), "Cannot interact with a chest you do not own");
        chestBalance[chestId] += getPendingInterest(chestId);
        lastUpdate[chestId] = block.timestamp;
        emit ChestBalanceUpdate(chestId, chestBalance[chestId]);
    }
    
    function getPendingInterest(uint256 chestId) public view returns(uint256) {
        uint256 interest = chestBalance[chestId] * DAILY_RATE * (block.timestamp - lastUpdate[chestId]) / 86400000;
        //Max 4 weeks of interest
        uint256 maxInterest = chestBalance[chestId] * 7 / 5;
        return interest < maxInterest ? interest : maxInterest;
    }
    //
    
    function walletOfOwner(address owner) external view returns(uint256[] memory) {
        uint256 tokenCount = balanceOf(owner);

        uint256[] memory tokensId = new uint256[](tokenCount);
        for(uint256 i; i < tokenCount; i++){
            tokensId[i] = tokenOfOwnerByIndex(owner, i);
        }
        return tokensId;
    }

    //Overrides
    function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function setBaseURI(string memory baseURI_) external onlyOwner() {
        _baseURIextended = baseURI_;
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return _baseURIextended;
    }
    //
    
    //Withdraw balance
    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        payable(msg.sender).transfer(balance);
    }
    //
}